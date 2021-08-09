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
    var thisGrid = new xwGrid(data['solution'], block = BLOCK);
    var words = [];
    var word_id = 1;
    var acrossEntries = thisGrid.acrossEntries();
    for (var i=0; i<acrossEntries.length; i++) {
        thisWord = {'id': word_id++, 'cells': acrossEntries[i]['cells']};
        words.append(thisWord);
    }
    var downEntries = thisGrid.downEntries();
    for (var i=0; i<downEntries.length; i++) {
        thisWord = {'id': word_id++, 'cells': downEntries[i]['cells']};
        words.append(thisWord);
    }

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

function xw_write_jpz(metadata, cells, words, clues) {
    var i, j;
    var title = escapeHtml(metadata.title);
    var author = escapeHtml(metadata.author);
    var copyright = escapeHtml(metadata.copyright);
    var description = escapeHtml(metadata.description);
    var jpz_string = `<?xml version="1.0" encoding="UTF-8"?>
<crossword-compiler-applet xmlns="http://crossword.info/xml/crossword-compiler">
<applet-settings width="720" height="600" cursor-color="#00FF00" selected-cells-color="#80FF80">
<completion friendly-submit="false" only-if-correct="true">Congratulations!  The puzzle is solved correctly</completion>
<actions graphical-buttons="false" wide-buttons="false" buttons-layout="left"><reveal-word label="Reveal Word"></reveal-word><reveal-letter label="Reveal"></reveal-letter><check label="Check"></check><solution label="Solution"></solution><pencil label="Pencil"></pencil></actions>
</applet-settings>
<rectangular-puzzle xmlns="http://crossword.info/xml/rectangular-puzzle" alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ">
<metadata>
<title>${title}</title>
<creator>${author}</creator>
<copyright>${copyright}</copyright>
<description>${description}</description>
</metadata>
<crossword>
<grid width="${metadata.width}" height="${metadata.height}">
<grid-look hide-lines="true" cell-size-in-pixels="25" />\n`;
    /* take care of cells in the grid */
    for (i=0; i<cells.length; i++) {
        var cell = cells[i];
        var clue_attrs = '';
        var cell_arr = Object.keys(cell);
        for (var j=0; j < cell_arr.length; j++) {
            var my_key = cell_arr[j];
            var my_val = cell[my_key];
            if (my_key == 'x' || my_key == 'y') {
                my_val = Number(my_val) + 1;
            }
            clue_attrs += `${my_key}="${my_val}" `;
        }
        jpz_string += `        <cell ${clue_attrs} />\n`;
    }
    jpz_string += "    </grid>\n";
    /* take care of the words */
    for (i=0; i<words.length; i++) {
        var word = words[i];
        jpz_string += `    <word id="${word.id}">\n`;
        for (j=0; j<word.cells.length; j++) {
            var word_cell = word.cells[j];
            var this_x = Number(word_cell[0]) + 1;
            var this_y = Number(word_cell[1]) + 1;
            jpz_string += `        <cells x="${this_x}" y="${this_y}" />\n`;
        }
        jpz_string += `    </word>\n`;
    }

    /* clues */
    for (i=0; i < clues.length; i++) {
        jpz_string += `    <clues ordering="normal">\n`;
        jpz_string += `        <title>${clues[i].title}</title>\n`;
        for (j=0; j < clues[i].clue.length; j++) {
            var my_clue = clues[i].clue[j];
            var my_clue_text = escapeHtml(my_clue.text);
            jpz_string += `        <clue word="${my_clue.word}" number="${my_clue.number}">${my_clue_text}</clue>\n`;
        }
        jpz_string += `    </clues>\n`;
    }
    jpz_string += `</crossword>
</rectangular-puzzle>
</crossword-compiler-applet>\n`;
    return jpz_string;
}
