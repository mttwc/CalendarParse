var response = window.calendarJson
var lines = response.recognitionResults.map(function (obj) { return obj.lines })[0]
var words = lines.map(function (line) { return line.words }).flat()

// Parse out date candidates
var dateNumbers = []
for (var i = 1; i <= 31; i++) {
    dateNumbers.push("" + i)
}
var dates = words.filter(function (word) { return word.text in dateNumbers })
var sortedDates = getNonDuplicateDates(dates.sort(function (a, b) { return parseInt(a.text) - parseInt(b.text) }))
console.log("Recognized dates", sortedDates)

// Try and get grid dimensions
var width = getGridWidth(sortedDates)
console.log("Width", width)
var height = getGridHeight(sortedDates)
console.log("Height", height)

// Remove dates that we heuristically detect are in incorrect locations (e.g., false positives)
var datesToRemove = []
for (var i = 0; i < sortedDates.length; i++) {
    var currentDate = sortedDates[i]
    var topCandidate = sortedDates.find(function (date) { return parseInt(date.text) === (parseInt(currentDate.text) - 7)})
    var bottomCandidate = sortedDates.find(function (date) { return parseInt(date.text) === (parseInt(currentDate.text) + 7)})
    var leftCandidate = sortedDates.find(function (date) { return parseInt(date.text) === (parseInt(currentDate.text) - 1)})
    var rightCandidate = sortedDates.find(function (date) { return parseInt(date.text) === (parseInt(currentDate.text) + 1)})

    if (topCandidate) {
        var dist = parseInt(currentDate.boundingBox[3]) - parseInt(topCandidate.boundingBox[3]) - height
        if (Math.abs(dist) > 40) {
            datesToRemove.push(currentDate.text)
            datesToRemove.push(topCandidate.text)
        }
    }

    // TODO Don't use bottom, left, right for now. This is good enough for demo.
}
console.log("Dates to remove", datesToRemove)
sortedDates = sortedDates.filter(function (date) { return !datesToRemove.includes(date.text)})
console.log("Dates with bad dates removed", sortedDates)

// Get missing dates
var presentDates = sortedDates.map(function (date) { return date.text })
var missingDates = dateNumbers.filter(function(candidate) { return !presentDates.includes(candidate) })
console.log("Missing dates", missingDates)

// Given existing dates, convert them to grid dimensions
var presentGrids = sortedDates.map(function (date) {
    var topRightX = date.boundingBox[2]
    var topRightY = date.boundingBox[3]
    return {
        text: date.text,
        topLeft: [topRightX - width, topRightY],
        topRight: [topRightX, topRightY],
        bottomRight: [topRightX, topRightY + height],
        bottomLeft: [topRightX - width, topRightY + height]
    }
})
console.log("Present grids", presentGrids)

// Given missing dates, determine and add their grids
var newGrids = []
while (missingDates.length > 0) {
    for (var i = 0; i < missingDates.length; i++) {
        var missingDate = missingDates[i]
        var topCandidate = presentGrids.find(function (date) { return parseInt(date.text) === (parseInt(missingDate) - 7)})
        var bottomCandidate = presentGrids.find(function (date) { return parseInt(date.text) === (parseInt(missingDate) + 7)})
        var leftCandidate = presentGrids.find(function (date) { return parseInt(date.text) === (parseInt(missingDate) - 1)})
        var rightCandidate = presentGrids.find(function (date) { return parseInt(date.text) === (parseInt(missingDate) + 1)})

        if (topCandidate) {
            presentGrids.push({
                text: missingDate,
                topLeft: [topCandidate.topLeft[0], topCandidate.topLeft[1] + height],
                topRight: [topCandidate.topRight[0], topCandidate.topRight[1] + height],
                bottomRight: [topCandidate.bottomRight[0], topCandidate.bottomRight[1] + height],
                bottomLeft: [topCandidate.bottomLeft[0], topCandidate.bottomLeft[1] + height]
            })
        } else if (bottomCandidate) {
            presentGrids.push({
                text: missingDate,
                topLeft: [bottomCandidate.topLeft[0], bottomCandidate.topLeft[1] - height],
                topRight: [bottomCandidate.topRight[0], bottomCandidate.topRight[1] - height],
                bottomRight: [bottomCandidate.bottomRight[0], bottomCandidate.bottomRight[1] - height],
                bottomLeft: [bottomCandidate.bottomLeft[0], bottomCandidate.bottomLeft[1] - height]
            })
        } else if (leftCandidate) {
            // Don't do this as there's no guarantee this is correct
        } else if (rightCandidate) {
            // Don't do this as there's no guarantee this is correct
        }
    }
    var presentNumbers = presentGrids.map(function (grid) { return grid.text })
    missingDates = dateNumbers.filter(function (dateNumber) { return !presentNumbers.includes(dateNumber) })
}

// Draw existing grids (TODO demo this by drawing grids at different stages of the algo)
var gridsToDraw = presentGrids
drawGrids(gridsToDraw)

// Get words TODO many false positives here, we need to fix
var nonNumberWords = words.filter(function (word) { return !dateNumbers.includes(word.text) })
nonNumberWords = nonNumberWords.map(function(word) {
    return {
        text: word.text,
        topLeft: [word.boundingBox[0], word.boundingBox[1]],
        topRight: [word.boundingBox[2], word.boundingBox[3]],
        bottomRight: [word.boundingBox[4], word.boundingBox[5]],
        bottomLeft: [word.boundingBox[6], word.boundingBox[7]],
    }
})
drawWords(nonNumberWords)

// For each word, determine the grid it belongs to (i.e., the most shared area)
var wordsInGrids = []
for (var i = 0; i < nonNumberWords.length; i++) {
    var word = nonNumberWords[i]
    var wordArea = Math.abs((word.topRight[0] - word.topLeft[0]) * (word.bottomRight[1] - word.topRight[1]))

    var winningGrid = null
    for (var j = 0; j < presentGrids.length; j++) {
        var grid = presentGrids[j]
        var gridArea = Math.abs(grid.topLeft[0] - grid.topRight[0]) * Math.abs(grid.topLeft[1] - grid.bottomRight[1])

        var intersect = getIntersectingRectangle(
            { x1: word.topLeft[0], y1: word.topLeft[1], x2: word.bottomRight[0], y2: word.bottomRight[1]},
            { x1: grid.topLeft[0], y1: grid.topLeft[1], x2: grid.bottomRight[0], y2: grid.bottomRight[1]})

        if (intersect !== false) {
            var area = Math.abs((intersect.x2 - intersect.x1) * (intersect.y2 - intersect.y1))
            if (!winningGrid) {
                winningGrid = { grid: grid, area: area}
            } else if (winningGrid.area < area) {
                winningGrid = { grid: grid, area: area}
            }
        }
    }
    if (winningGrid) {
        wordsInGrids.push({ word: word.text, winningGrid: winningGrid.grid.text })
    }
}

// TODO some missing words
console.log("wordsInGrids", wordsInGrids)
var presentWords = wordsInGrids.map(function (word) { return word.word })
var missingWords = nonNumberWords.filter(function (word) { return !presentWords.includes(word.text)})
console.log("missingWords", missingWords)

function getNonDuplicateDates(sortedDatesInner) {
    var singles = []
    var dateTextOnly = sortedDatesInner.map(function (date) { return date.text })
    var grouped = dateTextOnly.reduce((a, c) => (a[c] = (a[c] || 0) + 1, a), Object.create(null))
    for (var date in grouped) {
        if (grouped[date] === 1) {
            singles.push(date)
        }
    }
    return sortedDatesInner.filter(function (date) { return singles.includes(date.text) })
}

function getGridWidth(sortedDatesInner) {
    var result = []
    for (var i = 0; i < sortedDatesInner.length - 1; i++) {
        var a = sortedDatesInner[i]
        var b = sortedDatesInner[i + 1]
        if (parseInt(b.text) - parseInt(a.text) === 1) {
            // Determine if on the same horizontal plane
            var aTopRightY = a.boundingBox[3]
            var bTopRightY = b.boundingBox[3]
            if (Math.abs(bTopRightY - aTopRightY) <= 10) {
                //console.log(aTopRightY, bTopRightY)
                var width = b.boundingBox[2] - a.boundingBox[2]
                result.push(width)
            }
        }
    }
    // Median
    return result[Math.round(result.length / 2)]
}

function getGridHeight(sortedDatesInner) {
    var result = []
    for (var i = 0; i < sortedDatesInner.length; i++) {
        var a = sortedDatesInner[i]
        var b = sortedDatesInner.find(function(val, index) {
            return parseInt(val.text) - parseInt(a.text) === 7
        })
        if (b) {
            var height = b.boundingBox[3] - a.boundingBox[3]
            result.push(height)
        }
    }
    // Median
    return result[Math.round(result.length / 2)]
}

function drawGrids(gridsInner) {
    var canvas = document.getElementById("canvas")
    var context = canvas.getContext("2d")
    for (var i = 0; i < gridsInner.length; i++) {
        var grid = gridsInner[i]
        context.rect(grid.topLeft[0], grid.topLeft[1], width, height)
        context.stroke()

        context.font = "100px Arial"
        context.strokeText(grid.text, grid.topLeft[0], grid.topLeft[1])
    }
}

function drawWords(wordsInner) {
    var canvas = document.getElementById("canvas")
    var context = canvas.getContext("2d")
    // Draw word
    for (var i = 0; i < wordsInner.length; i++) {
        var word = wordsInner[i]
        context.font = "30px Arial"
        context.strokeText(word.text, word.bottomLeft[0], word.bottomLeft[1])
    }

    // Draw bounding box
    for (var i = 0; i < wordsInner.length; i++) {
        var word = wordsInner[i]
        context.rect(word.topLeft[0], word.topLeft[1],
            word.topRight[0] - word.topLeft[0], word.bottomRight[1] - word.topRight[1])
        context.stroke()
    }
}

function getIntersectingRectangle(r1, r2) {  
    var comparator = (a, b) => { return a - b } 
    [r1, r2] = [r1, r2].map(r => {
      return {x: [r.x1, r.x2].sort(comparator), y: [r.y1, r.y2].sort(comparator)}
    });
  
    var noIntersect = r2.x[0] > r1.x[1] || r2.x[1] < r1.x[0] ||
                        r2.y[0] > r1.y[1] || r2.y[1] < r1.y[0]
  
    return noIntersect ? false : {
      x1: Math.max(r1.x[0], r2.x[0]), // _[0] is the lesser,
      y1: Math.max(r1.y[0], r2.y[0]), // _[1] is the greater
      x2: Math.min(r1.x[1], r2.x[1]),
      y2: Math.min(r1.y[1], r2.y[1])
    }
}