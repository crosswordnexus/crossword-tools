/**
* Class for a crossword grid
**/
class xwGrid {
    constructor(soln_arr, block='.') {
        this.solution = soln_arr;
        this.block = block;
        // width and height
        this.height = soln_arr.length;
        this.width = soln_arr[0].length;
        // Grid numbering
        this.numbers = this.gridNumbering();
    }
    isBlack(x, y) {
        return this.solution[y][x] === this.block;
    }
    startAcrossWord(x, y) {
        return (x === 0 || this.isBlack(x - 1, y)) && x < this.width - 1 && !this.isBlack(x, y) && !this.isBlack(x + 1, y);
    }
    startDownWord(x, y) {
        return (y === 0 || this.isBlack(x, y - 1)) && y < this.height - 1 && !this.isBlack(x, y) && !this.isBlack(x, y + 1);
    }
    letterAt(x, y) {
        return this.solution[y][x];
    }
    gridNumbering() {
        var numbers = [];
        var thisNumber = 1;
        for (var y=0; y < this.height; y++) {
            var thisNumbers = [];
            for (var x=0; x < this.width; x++) {
                if (this.isBlack(x, y)) {
                }
                if (this.startAcrossWord(x, y) || this.startDownWord(x, y)) {
                    thisNumbers.push(thisNumber);
                    thisNumber += 1;
                }
                else {
                    thisNumbers.push(0);
                }
            }
            numbers.push(thisNumbers);
        }
        return numbers;
    }

    acrossEntries() {
        var acrossEntries = {}, x, y, thisNum;
        for (y = 0; y < this.height; y++) {
            for (x = 0; x < this.width; x++) {
                if (this.startAcrossWord(x, y)) {
                    thisNum = this.numbers[y][x];
                    if (!acrossEntries[thisNum] && thisNum) {
                        acrossEntries[thisNum] = {'word': '', 'cells': []};
                    }
                }
                if (!this.isBlack(x, y) && thisNum) {
                    var letter = this.letterAt(x, y);
                    acrossEntries[thisNum]['word'] += letter;
                    acrossEntries[thisNum]['cells'].push([x, y]);
                }
            }
        }
        return acrossEntries;
    }

    downEntries() {
        var downEntries = {}, x, y, thisNum;
        for (x = 0; x < this.width; x++) {
            for (y = 0; y < this.height; y++) {
                if (this.startDownWord(x, y)) {
                    thisNum = this.numbers[y][x];
                    if (!downEntries[thisNum] && thisNum) {
                        downEntries[thisNum] = {'word': '', 'cells': []};
                    }
                }
                if (!this.isBlack(x, y) && thisNum) {
                    var letter = this.letterAt(x, y);
                    downEntries[thisNum]['word'] += letter;
                    downEntries[thisNum]['cells'].push([x, y]);
                }
            }
        }
        return downEntries;
    }

}


// function to get an index from an i, j, and width
function xw_ij_to_index(i, j, w) {
    return j * w + i;
}

// function to convert an index to i, j
function xw_index_to_ij(ix, w) {
    var j = Math.floor(ix/w);
    var i = ix - j*w;
    return [i, j];
}

function XMLElementToString(element) {
    var i,
        node,
        nodename,
        nodes = element.childNodes,
        result = '';
    for (i = 0; (node = nodes[i]); i++) {
        if (node.nodeType === 3) {
            result += node.textContent;
        }
        if (node.nodeType === 1) {
            nodename = node.nodeName;
            result +=
              '<' +
              nodename +
              '>' +
              XMLElementToString(node) +
              '</' +
              nodename +
              '>';
        }
    }
    return result;
}

/** Generic file download function **/
function file_download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

class JSCrossword {
    /*
    * `metadata` has title, author, copyright, description (notes), height, width, crossword_type
    * `cells` is an array of cells with the various attributes
      - x and y (0-indexed)
      - "type" = 'block' if it's a block
      - "number" = number if it's numbered
      - "solution" = letter(s) that go in the box
      - others: background-color (RGB), background-shape (circle),
          bottom-bar, right-bar, top-bar, left-bar (= true if exist)

    * `words` is an array of objects, each with an "id" and a "cells" attribute
      "id" is just a unique number to match up with the clues.
      "cells" is an array of objects giving the x and y values, in order
    * `clues` is an array of (usually) two objects.
       each object within has a "title" key whose value is generally "ACROSS" or "DOWN"
       and a "clue" key, whose value is an array of clues.
       Each "clue" key has
         - a "text" value which is the actual clue
         - a "word" which is the associated word ID
         - an optional "number"
    */
    constructor(metadata, cells, words, clues) {
        this.metadata = metadata;
        this.cells = cells;
        this.words = words;
        this.clues = clues;
    }

    //CROSSWORD_TYPES = ['crossword', 'coded', 'acrostic'];

    /**
    * useful functions
    **/
    /** get the full word from a word ID **/
    wordid_to_word(id) {
        var entry = '';
        var this_word;
        this.words.forEach(function(w) {
            if (w.id == id) {
                this_word = w;
            }
        });
        // take a slight dynamic programming approach
        // and get our cells the way we want before looping
        var cell_obj = {};
        this.cells.forEach(function(c) {
            var _key = c.x.toString() + '-' + c.y.toString();
            var soln = c.solution;
            cell_obj[_key] = soln;
        });
        // go through this word and get the solution for each cell
        this_word.cells.forEach(function(c) {
            var new_key = c[0].toString() + '-' + c[1].toString();
            entry += cell_obj[new_key];
        });
        return entry;
    }

    /**
    * Read in data from various file formats
    **/

    /** puz **/
    // requires puz_read_write.js
    fromPuz(contents) {
        // Read data into a puzapp
        var puzdata = PUZAPP.parsepuz(contents);
        return jscrossword_from_puz(puzdata);
    }

    /** JPZ **/
    // requires jpz_read_write.js (and JSZip??)
    fromJPZ(data) {
        return xw_read_jpz(data);
    }

    /** iPUZ **/
    // requires ipuz_read_write.js
    fromIpuz(data) {
        return xw_read_ipuz(data);
    }

    /**
    * Write data for downloads
    **/

    /**
    * write JPZ
    **/
    toJPZString() {
        return xw_write_jpz(this.metadata, this.cells, this.words, this.clues);
    }
}
