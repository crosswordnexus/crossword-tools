/**
* CFP (CrossFire) reading and writing functions
**/

/* parsexml function via https://stackoverflow.com/a/19448718 */
function parseXml(e,r){let t=null;if(window.DOMParser)t=(new DOMParser).parseFromString(e,"text/xml");else{if(!window.ActiveXObject)throw new Error("cannot parse xml string!");if((t=new ActiveXObject("Microsoft.XMLDOM")).async=!1,!t.loadXML(e))throw t.parseError.reason+" "+t.parseError.srcText}function o(e,t){if("#text"==e.nodeName){let r=e.nodeValue;return void(r.trim()&&(t["#text"]=r))}let n={},a=t[e.nodeName];if(a?Array.isArray(a)?t[e.nodeName].push(n):t[e.nodeName]=[a,n]:r&&-1!=r.indexOf(e.nodeName)?t[e.nodeName]=[n]:t[e.nodeName]=n,e.attributes)for(let r of e.attributes)n[r.nodeName]=r.nodeValue;for(let r of e.childNodes)o(r,n)}let n={};for(let e of t.childNodes)o(e,n);return n}

function xw_read_cfp(xml) {
  // Read the XML into an object
  var dataObj = parseXml(xml);
  dataObj = dataObj.CROSSFIRE;
  // Pull in the metadata
  var grid_str = dataObj.GRID['#text'].trim();
  var grid_arr = grid_str.split('\n');
  var width = dataObj.GRID.width;
  var height = grid_arr.length
  var metadata = {
      'title': dataObj.TITLE['#text'] || '',
      'author': dataObj.AUTHOR['#text'] || '',
      'copyright': dataObj.COPYRIGHT['#text'] || '',
      'description': dataObj.NOTES['#text'] || '',
      'height': height,
      'width': width,
      'crossword_type': 'crossword',
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
  // Get circle locations if they exist
  var circle_locations = new Set();
  if (dataObj.CIRCLES) {
    circle_locations = new Set(dataObj.CIRCLES['#text'].split(',').map(Number));
  }
  // Get rebus indicators if they exist
  var rebusObj = {};
  if (dataObj.REBUSES.REBUS) {
    dataObj.REBUSES.REBUS.forEach( function(r) {
      rebusObj[r.input] = r.letters.toUpperCase();
    });
  }
  var cells = [];
  for (var y=0; y < height; y++) {
      for (var x=0; x < width; x++) {
          // the grid index
          var this_index = x + y * width;

          // solution
          var solution = grid_arr[y].charAt(x);
          // replace with rebus if necessary
          solution = rebusObj[solution] || solution;
          // type
          var type = null;
          if (solution === '.') {
              type = 'block';
          }

          // background shape and color
          background_shape = null;
          if (circle_locations.has(this_index)) {
            background_shape = 'circle';
          }

          var new_cell = {
              x: x,
              y: y,
              solution: solution,
              number: null, // for now
              type: type,
              "background-shape": background_shape,
          };
          cells.push(new_cell);
      } // end for x
  } // end for y

  // In order to add numbering to this we need a xwGrid object
  var thisGrid = new xwGrid(cells);
  var gn = thisGrid.gridNumbering();
  cells.forEach(function(cell) {
    var thisNumber = gn[cell.y][cell.x];
    if (thisNumber) {
      cell.number = thisNumber;
    }
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
  var words = [];
  // Iterate through the titles of the clues
  var entries = {'ACROSS': thisGrid.acrossEntries(), 'DOWN': thisGrid.downEntries()};
  var clues1 = {'ACROSS': [], 'DOWN': []};
  // clues and words are coupled in .cfp
  dataObj.WORDS.WORD.forEach( function(w) {
      var word_id = w.id;
      var number = w.num;
      var text = w['#text'];
      var thisDir = w.dir;
      clues1[thisDir].push({'word': word_id, 'number': number, 'text': text});
      var thisCells = entries[thisDir][Number(number)].cells;
      words.push({'id': word_id, 'cells': thisCells});
  });
  var clues = [{'title': 'ACROSS', 'clue': clues1['ACROSS']}, {'title': 'DOWN', 'clue': clues1['DOWN']}];

  return new JSCrossword(metadata, cells, words, clues);
}

function xw_write_cfp(metadata, cells, words, clues) {
}
