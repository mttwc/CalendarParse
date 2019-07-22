var response = window.calendarJson
var lines = response.recognitionResults.map(function (obj) { return obj.lines })[0]
var words = lines.map(function (line) { return line.words }).flat()

var dateNumbers = []
for (var i = 1; i <= 31; i++) {
    dateNumbers.push("" + i)
}
var dates = words.filter(function (word) { return word.text in dateNumbers })
var sortedDates = dates.sort(function (a, b) { return parseInt(a.text) - parseInt(b.text) })

console.log(sortedDates)