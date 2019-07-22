var response = window.calendarJson
var lines = response.recognitionResults.map(function (obj) { return obj.lines })[0]
var words = lines.map(function (line) { return line.words }).flat()

// Parse out date candidates
var dateNumbers = []
for (var i = 1; i <= 31; i++) {
    dateNumbers.push("" + i)
}
var dates = words.filter(function (word) { return word.text in dateNumbers })
var sortedDates = dates.sort(function (a, b) { return parseInt(a.text) - parseInt(b.text) })
console.log("Recognized dates", sortedDates)

// Try and get grid dimensions
var width = getGridWidth(sortedDates)
console.log("Width", width)

var height = getGridHeight(sortedDates)
console.log("Height", height)




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