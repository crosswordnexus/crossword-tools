/**
* iPUZ reading/writing functions
* copyright (c) 2021 Crossword Nexus
* MIT License https://opensource.org/licenses/MIT
**/

function xw_read_ipuz(data) {
    // If `data` is a string, convert to object
    if (typeof(data) === 'string') {
        data = JSON.parse(data);
    }
    /*
    * `metadata` has title, author, copyright, description (notes), height, width, crossword_type
    */
    // determine the type of the crossword
    var kind = data['kind'][0];

    // determine what represents a block
    const BLOCK = data['block'] || '#';

    // We only support "crossword" for now
    // TODO: add in acrostic support
    if (kind.indexOf('crossword') !== -1) {
        var crossword_type = 'crossword';
    } else {
        throw `${kind} is not supported`;
    }
    var height = data["dimensions"]["height"];
    var width = data["dimensions"]["width"];
    var metadata = {
        'title': data['title'] || '',
        'author': data['author'] || '',
        'copyright': data['copyright'] || '',
        'description': data.intro || '',
        'height': height,
        'width': width,
        'crossword_type': crossword_type
    };

    /*
    * `cells` is an array of cells with the various attributes
      - x and y (0-indexed)
      - "type" = 'block' if it's a block
      - "number" = number if it's numbered
      - "solution" = letter(s) that go in the box
      - others: background-color (RGB), background-shape (circle),
          bottom-bar, right-bar, top-bar, left-bar (= true if exist)
    */
    var cells = [];
    for (var y=0; y < height; y++) {
        for (var x=0; x < width; x++) {
            // number
            var background_shape = null;
            var background_color = null;
            var cell_attributes = data['puzzle'][y][x];
            if (typeof(cell_attributes) !== 'object') {
                var number = cell_attributes.toString();
            }
            else {
                var number = cell_attributes['cell'];
                if (cell_attributes.style) {
                    background_shape = cell_attributes.style.shapebg;
                    background_color = cell_attributes.style.color;
                }
            }
            if (number === 0 || number === BLOCK) {
                number = null;
            }
            // solution
            var solution = data['solution'][y][x];
            // type
            var type = null;
            if (solution == BLOCK) {
                type == 'block';
            }
            var new_cell = {
                x: x,
                y: y,
                solution: solution,
                number: number,
                type: type,
                "background-color": background_color,
                "background-shape": background_shape,
                letter: null,
                top_right_number: null, // todo: we can get this
                is_void: null,
                clue: null,
                value: null
            };
            cells.push(new_cell);
        } // end for x
    } // end for y

    /*
    * `words` is an array of objects, each with an "id" and a "cells" attribute
      "id" is just a unique number to match up with the clues.
      "cells" is an array of objects giving the x and y values, in order
    */
    var thisGrid = new xwGrid(data['solution'], block=BLOCK);
    var words = [];
    var word_id = 1;
    var acrossEntries = thisGrid.acrossEntries();
    Object.keys(acrossEntries).forEach(function(i) {
        thisWord = {'id': word_id++, 'cells': acrossEntries[i]['cells']};
        words.push(thisWord);
    });
    var downEntries = thisGrid.downEntries();
    Object.keys(downEntries).forEach(function(i) {
        thisWord = {'id': word_id++, 'cells': downEntries[i]['cells']};
        words.push(thisWord);
    });

    /*
    * `clues` is an array of (usually) two objects.
       each object within has a "title" key whose value is generally "ACROSS" or "DOWN"
       and a "clue" key, whose value is an array of clues.
       Each "clue" key has
         - a "text" value which is the actual clue
         - a "word" which is the associated word ID
         - an optional "number"
    */
    // Note: we only handle "Across" and "Down" in iPuz for now
    // TODO: handle other directions
    var clues = [];
    word_id = 1;
    ['Across', 'Down'].forEach( function(title) {
        var thisClues = [];
        data['clues'][title].forEach( function (clue) {
            thisClues.push({'word': word_id++, 'number': clue[0], 'text': clue[1]});
        });
        clues.push({'title': title, 'clue': thisClues});
    });

    return new JSCrossword(metadata, cells, words, clues);
}

function xw_write_ipuz(metadata, cells, words, clues) {
}
