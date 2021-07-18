#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import mip # pip install mip
import logging
import re
from collections import Counter
import string
import random
import time
import sys, getopt, os

WORDLIST1 = r'acrostic_wordlist.txt'
MIN_SCORE = 90

###################

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
WORDLIST = os.path.join(THIS_DIR, WORDLIST1)

# Set up logging
logging.basicConfig(format='%(levelname)s [%(asctime)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=logging.INFO)

def is_substring(s1, s2):
    """
    Returns True if the letters of s1 are in s2; False otherwise
    """
    d1 = Counter(s1)
    d2 = Counter(s2)
    for k, v in d1.items():
        if d2.get(k, 0) < d1.get(k):
            return False
    return True

def letter_count(word, letter):
    """
    Returns the number of instances of "letter" in "word"
    """
    return word.count(letter)

def alpha_only(s):
    """
    Strip any non-alpha characters from s, and convert to lowercase
    """
    return re.sub(r'[^A-Za-z]+', '', s.lower())

def to_apz(kotwords_dict, source):
    """
    Create an APZ string for
    https://jpd236.github.io/kotwords/acrostic.html
    """
    clues = '\n'.join([f'CLUE_FOR_{x}' for x in kotwords_dict['answers'].split('\n')])
    xml = f'''<?xml version="1.0" encoding="UTF-8" ?>
<!-- Acrostic text file -->
<puzzle>
<metadata>
    <!-- These first three fields should be self-explanatory -->
    <title>PUZZLE_TITLE_HERE</title>
    <creator>PUZZLE_AUTHOR_HERE</creator>
    <copyright>PUZZLE_COPYRIGHT_HERE</copyright>
    <!-- Suggested Width can be filled if you want to suggest a width for the grid -->
    <suggestedwidth></suggestedwidth>
    <apzversion>1.0</apzversion>
    <description/>
</metadata>
<!-- In the solution, use spaces for word breaks. Omit any punctuation (commas,
periods, etc.) unless you want it to get its own prefilled, uneditable square
in the quote grid.  NOTE: the solution must be all uppercase. -->
<solution>{kotwords_dict['solution'].upper()}</solution>
<!-- Source and Quote will be displayed upon successful completion.
Typically the quote has more punctuation than the "solution" -->
<source>
{source}
</source>
<quote>
{kotwords_dict['solution']}
</quote>
<!-- fullquote is not currently used. -->
<fullquote>
{kotwords_dict['solution']}
</fullquote>
<gridkey>
{kotwords_dict['grid_key']}
</gridkey>
<answers>
{kotwords_dict['answers']}
</answers>
<clues>
{clues}
</clues>
</puzzle>
'''
    return xml

def create_kotwords_export(quote, source, solution_array):
    """
    Create inputs for
    https://jpd236.github.io/kotwords/acrostic.html
    """
    ret = {}
    # Solution
    ret['solution'] = quote

    # Grid key
    grid_key = []
    quote_letter_positions = dict()
    quote_alpha = alpha_only(quote)
    for i, l in enumerate(quote_alpha):
        quote_letter_positions[l] = quote_letter_positions.get(l, []) + [i]
    for l in quote_letter_positions.keys():
        random.shuffle(quote_letter_positions[l])
    for s in solution_array:
        this_arr = []
        for l in s:
            this_arr.append(str(quote_letter_positions[l].pop() + 1))
        grid_key.append(' '.join(this_arr))
    ret['grid_key'] = '\n'.join(grid_key)

    # Answers
    answers = []
    for x in solution_array:
        answers.append(x.upper())
    ret['answers'] = '\n'.join(answers)

    # Completion message
    completion_message = ''
    completion_message += source + '\n'
    completion_message += '\n'
    completion_message += quote
    ret['completion_message'] = completion_message

    return ret

def create_acrostic(quote, source, excluded_words=[]):
    """

    Parameters
    ----------
    quote : string
        The quote we want to make an acrostic puzzle from.
    source : string
        The source of the quote (usually the author + work).
    excluded_words : list (optional)
        Words not to include in a solution.

    Returns
    -------
    soln_array: list
        A list of words comprising a feasible acrostic.

    """
    t1 = time.time()

    # Normalize the inputs
    source_alpha = alpha_only(source.strip())
    quote_alpha = alpha_only(quote)

    # Set up our letter constraint targets
    logging.info('Setting up constraint targets')
    quote_counter = Counter(quote_alpha)
    source_counter = Counter(source_alpha)
    source_letters = set(source_counter)
    b = dict()
    for letter in string.ascii_lowercase:
        b[letter] = quote_counter.get(letter, 0)
    for letter in string.ascii_lowercase:
        b[f'_{letter}'] = source_counter.get(letter, 0)

    # Set up the integer programming model
    m = mip.Model()

    # Create our variables -- they're the words
    excluded_words_set = set([x.lower().strip() for x in excluded_words])
    logging.info('Setting up variables')
    words_var = []
    words = []
    with open(WORDLIST, 'r') as fid:
        for line in fid:
            line = line.strip().lower()
            word, score = line.split(';')
            if int(score) >= MIN_SCORE and len(word) >= 4 and len(word) <= 12 \
                and word[0] in source_letters and is_substring(word, quote_alpha) \
                and word not in excluded_words_set:
                # Create a variable from this word
                words_var.append(m.add_var(name=word, var_type=mip.BINARY))
                words.append(word)

    NUM_WORDS = len(words)

    # Set up our constraints
    # First: the constraint on the letter count
    logging.info('Setting up constraints')
    for letter in string.ascii_lowercase:
        m += mip.xsum(letter_count(words[i], letter) * words_var[i] for i in range(NUM_WORDS)) == b[letter]
    # Second: constraint on the first letters
    for letter in string.ascii_lowercase:
        m += mip.xsum(int(words[i].startswith(letter)) * words_var[i] for i in range(NUM_WORDS)) == b[f'_{letter}']

    # Optional objective: all words approximately the same length
    #m.objective = mip.minimize(mip.xsum(words_var[i] * len(words[i])**2 for i in range(NUM_WORDS)))

    # Run the optimization.  This is the potential bottleneck.
    logging.info('Optimizing')
    m.optimize()

    #logging.info(m.num_solutions)

    t2 = time.time()
    logging.info('Complete. Total time: {0:.2f} seconds'.format(t2 - t1))

    solution_words = dict()
    for v in m.vars:
        if v.x is None:
            return []
        elif v.x > 0.99:
            solution_words[v.name[0]] = solution_words.get(v.name[0], []) + [v.name]

    solution_array = []
    for letter in source_alpha:
        x = solution_words[letter].pop()
        solution_array.append(x)

    return solution_array
#END create_acrostic()

def main(argv=None):
    if argv is None:
        argv = sys.argv

    quote = ''
    source = ''
    excluded = []

    try:
        try:
            opts, args = getopt.getopt(argv[1:], "q:s:x:", ["quote=", "source=", "excluded="])
        except getopt.error as msg:
             raise msg
        for o,a in opts:
            if o in ('-q','--quote'):
                # the quote you want to make an acrostic puzzle from
                quote = a
            elif o in ('-s','--source'):
                # the "source", usually the author and title
                source = a
            elif o in ('-x', '--excluded'):
                # a comma-separated list of words not to include
                excluded=[_.strip().lower() for _ in a.split(',')]

        # Execute the code
        soln_array = create_acrostic(quote, source, excluded_words=excluded)
        for x in soln_array:
            print(x.upper())

    except Exception as err:
        raise err
        return 2

#%%
if __name__ == "__main__":
    sys.exit(main())
