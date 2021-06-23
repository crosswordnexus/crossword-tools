/**
* JPZ reading/writing functions
* copyright (c) 2021 Crossword Nexus
* MIT License https://opensource.org/licenses/MIT
**/

// helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

function xw_read_jpz(data) {
    var ERR_PARSE_JPZ = 'Error parsing JPZ file.';
    // check if it's zipped
    if (data.match(/^<\?xml/)) {
        // do nothing
    }
    else {
        // not yet supported
        alert("can't yet handle zipped xml");
    }
    // create a DOMParser object
    var xml_string = data.replace('&nbsp;', ' ');
    var parser, xmlDoc;
    if (window.DOMParser) {
        parser = new DOMParser();
        xmlDoc = parser.parseFromString(xml_string, 'text/xml');
    } else {
        // Internet Explorer
        xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
        xmlDoc.async = false;
        xmlDoc.loadXML(xml_string);
    }
    var crossword, puzzle, jpz_metadata;
    puzzle = xmlDoc.getElementsByTagName('rectangular-puzzle');
    if (!puzzle.length) {
        alert(ERR_PARSE_JPZ);
        return;
    }

    // determine the type of the crossword
    var crossword_type;
    for (var _i = 0; _i < this.CROSSWORD_TYPES.length; _i++) {
        crossword_type = this.CROSSWORD_TYPES[_i];
        crossword = xmlDoc.getElementsByTagName(crossword_type);
        if (crossword.length > 0) {
            break;
        }
    }
    crossword = crossword[0];

    // metadata
    jpz_metadata = puzzle[0].getElementsByTagName('metadata');
    if (!jpz_metadata.length) {
        alert('could not find metadata');
        return;
    }

    var metadata = {'title': '', 'author': '', 'copyright': '', 'description': ''};

    var title = jpz_metadata[0].getElementsByTagName('title');
    var creator = jpz_metadata[0].getElementsByTagName('creator');
    var copyright = jpz_metadata[0].getElementsByTagName('copyright');
    var description = jpz_metadata[0].getElementsByTagName('description');

    if (title.length) {
        metadata['title'] = XMLElementToString(title[0]);
    }
    if (creator.length) {
        metadata['author'] = XMLElementToString(creator[0]);
    }
    if (copyright.length) {
        metadata['copyright'] = XMLElementToString(copyright[0]);
    }
    if (description.length) {
        description = XMLElementToString(description[0]);
    }

    metadata['crossword_type'] = crossword_type;

    // logic for check/reveal buttons
    // TODO: expand on this
    var applet_settings = xmlDoc.getElementsByTagName('applet-settings');
    if (applet_settings.length) {
        var elt = applet_settings[0].getElementsByTagName('solution');
        if (!elt.length) {
            metadata['hide_reveal'] = true;
        }
    }

    // solved message
    var completion = xmlDoc.getElementsByTagName('completion');
    if (completion.length) {
        metadata['completion_message'] = XMLElementToString(completion[0]);
    }

    // cells
    var cells = [];
    var i,
        cell,
        word,
        clues_block,
        grid = crossword.getElementsByTagName('grid')[0],
        grid_look = grid.getElementsByTagName('grid-look')[0],
        xml_cells = grid.getElementsByTagName('cell'),
        xml_words = crossword.getElementsByTagName('word'),
        xml_clues = crossword.getElementsByTagName('clues');

    metadata.width = Number(grid.getAttribute('width'));
    metadata.height = Number(grid.getAttribute('height'));

    for (i=0; (cell = xml_cells[i]); i++) {
        var new_cell = {
            x: Number(cell.getAttribute('x')),
            y: Number(cell.getAttribute('y')),
            solution: cell.getAttribute('solution'),
            number: cell.getAttribute('number'),
            "background-color": cell.getAttribute('background-color'),
            "background-shape": cell.getAttribute('background-shape'),
            empty: (cell.getAttribute('type') === 'block' || cell.getAttribute('type') === 'void' || cell.getAttribute('type') === 'clue'),
            letter: cell.getAttribute('solve-state'),
            top_right_number: cell.getAttribute('top-right-number'),
            is_void: cell.getAttribute('type') === 'void',
            clue: cell.getAttribute('type') === 'clue',
            value: cell.textContent
        };

        // for barred puzzles
        if (
          cell.getAttribute('top-bar') ||
          cell.getAttribute('bottom-bar') ||
          cell.getAttribute('left-bar') ||
          cell.getAttribute('right-bar')
        ) {
            new_cell.bar = {
              top: cell.getAttribute('top-bar') === 'true',
              bottom: cell.getAttribute('bottom-bar') === 'true',
              left: cell.getAttribute('left-bar') === 'true',
              right: cell.getAttribute('right-bar') === 'true',
            };
        }
        cells.push(new_cell);
    }


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