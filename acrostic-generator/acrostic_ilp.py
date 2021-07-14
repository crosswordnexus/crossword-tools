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

WORDLIST = r'xwordlist.dict'
MIN_SCORE = 90

# Set up logging
logging.basicConfig(format='%(levelname)s [%(asctime)s] %(message)s', datefmt='%Y-%m-%d %H:%M:%S', level=logging.INFO)

def is_substring(s1, s2):
    d1 = Counter(s1)
    d2 = Counter(s2)
    for k, v in d1.items():
        if d2.get(k, 0) < d1.get(k):
            return False
    return True

def letter_count(word, letter):
    return word.count(letter)

def alpha_only(s):
    return re.sub(r'[^A-Za-z]+', '', s.lower())

def create_kotwords_export(quote, author, work, solution_array):
    """
    Create inputs for 
    https://jpd236.github.io/kotwords/acrostic.html
    """
    ret = {}
    # Solution
    ret['solution'] = quote
    
    # Grid key
    grid_key = ''
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
        grid_key += ' '.join(this_arr) + '\n'
    ret['grid_key'] = grid_key
    
    # Answers
    answers = ''
    for x in solution_array:
        answers += x.upper() + '\n'
    ret['answers'] = answers
        
    # Completion message
    completion_message = ''
    completion_message += author + ' -- ' + work + '\n'
    completion_message += '\n'
    completion_message += quote
    ret['completion_message'] = completion_message
    
    return ret

def create_acrostic(quote, author, work, excluded_words=[]):
    """

    Parameters
    ----------
    quote : string
        The quote we want to make an acrostic puzzle from.
    author : string
        The author of the quote.
    work : string
        The book (or whatever) the quote is from.

    Returns
    -------
    None.

    """
    t1 = time.time()
    
    # Normalize the inputs
    source = alpha_only(author.strip() + work.strip())
    quote_alpha = alpha_only(quote)

    # Set up our letter constraint targets
    logging.info('Setting up constraint targets')
    quote_counter = Counter(quote_alpha)
    source_counter = Counter(source)
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

    # Run the optimization.  This is the potential bottleneck.
    logging.info('Optimizing')
    m.optimize()

    t2 = time.time()
    logging.info('Complete. Total time: {0:.2f} seconds'.format(t2 - t1))

    solution_words = dict()
    for v in m.vars:
        if v.x is None:
            return []
        elif v.x > 0.99:
            solution_words[v.name[0]] = solution_words.get(v.name[0], []) + [v.name]
    
    solution_array = []
    for letter in source:
        x = solution_words[letter].pop()
        solution_array.append(x)
        
    return solution_array

def main(argv=None):
    if argv is None:
        argv = sys.argv

    quote = ''
    author = ''
    work = ''

    try:
        try:
            opts, args = getopt.getopt(argv[1:], "q:a:w:", ["quote=", "author=", "work="])
        except getopt.error as msg:
             raise msg
        for o,a in opts:
            if o in ('-q','--quote'):
                quote = a
            elif o in ('-a','--author'):
                author = a
            elif o in ('-w','--work'):
                work = a

        # Execute the code
        soln_array = create_acrostic(quote, author, work)
        for x in soln_array:
            print(x.upper())

    except Exception as err:
        print(err)
        return 2

#%%
if __name__ == "__main__":
    sys.exit(main())
