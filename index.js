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