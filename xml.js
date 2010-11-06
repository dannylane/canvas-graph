//http://nikerunning.nike.com/nikeplus/v2/services/app/run_list.jsp?userID=1224067931&startIndex=90&endIndex=94&filterBy=all
//var cachedXML = '<plusService><status>success</status><runList endIndex="94" startIndex="90"><run id="339885865" workoutType="standard"><startTime>2010-08-22T11:14:08+01:00</startTime><distance>24.7833</distance><duration>8557776</duration><syncTime>2010-08-27T22:07:00+00:00</syncTime><calories>1745.0</calories><name/><description/><howFelt/><weather/><terrain/><intensity/><gpxId/><equipmentType>ipod</equipmentType></run><run id="205713023" workoutType="standard"><startTime>2010-08-25T07:16:12+01:00</startTime><distance>0.0193</distance><duration>26642</duration><syncTime>2010-08-27T22:07:02+00:00</syncTime><name/><description/><howFelt/><weather/><terrain/><intensity/><gpxId/><equipmentType>ipod</equipmentType></run><run id="1078107810" workoutType="standard"><startTime>2010-08-25T07:18:19+01:00</startTime><distance>4.8452</distance><duration>1510231</duration><syncTime>2010-08-27T22:07:04+00:00</syncTime><calories>341.0</calories><name/><description/><howFelt/><weather/><terrain/><intensity/><gpxId/><equipmentType>ipod</equipmentType></run><run id="205708179" workoutType="standard"><startTime>2010-08-26T18:49:39+01:00</startTime><distance>10.7665</distance><duration>3239650</duration><syncTime>2010-08-27T22:07:06+00:00</syncTime><calories>758.0</calories><name/><description/><howFelt/><weather/><terrain/><intensity/><gpxId/><equipmentType>ipod</equipmentType></run></runList><runListSummary><runs>94</runs><distance>782.73</distance><duration>265891046</duration><calories>50127.0</calories></runListSummary></plusService>';
var service = '/nikeplus/v2/services/app/run_list.jsp?userID=1224067931&startIndex=20&endIndex=120&filterBy=all';
var responseStr = '';
var parsedStr = '';

var log4js = require('./lib/log4js');
var xml = require('./lib/node-xml');
var fs = require('fs');
var http = require('http');

// set up logs
log4js.addAppender(log4js.consoleAppender());
log4js.addAppender(log4js.fileAppender('visitors.txt'), 'visitors');
var log = log4js.getLogger('visitors');
log.setLevel('INFO');

// parser for parsing the xml returned by the nike service
var parser = new xml.SaxParser(function(cb){
    var runs = new Array();
    var parseRun = new Boolean();
    parseRun = false;
    var runIndex = -1;
    var nodeName;
    
    cb.onStartElementNS(function(elem, attrs, prefix, uri, namespaces){
		// for each run element create a new obj in the array
        if (elem === 'run') {
            runIndex += 1;
            runs[runIndex] = new Object();
        }
		// skip all the other elements in the doc, only interested in the runs
        if (elem === 'runList') {
            parseRun = true;
        }
		// all we are interested in here is the name of the element we are about to parse
        nodeName = elem;
    });
    
    cb.onEndElementNS(function(elem, prefix, uri){
		// when we get to the end of the run list stop parsing
        if (elem === 'runList') {
            parseRun = false;
        }
    });
    
    cb.onCharacters(function(chars){
		// if this is a run then we save the text in the element for this run
        if (parseRun) {
            runs[runIndex][nodeName] = chars;
        }
    });
    
    cb.onEndDocument(function(){
		// save the array of objs as a json str
        parsedStr = JSON.stringify(runs);
    });
    
});

 // create the http client to get the data from the nike web service
 var nike = http.createClient(80, 'nikerunning.nike.com');
 
 // create a request on the http client 
 var request = nike.request('GET', service, {'host' : 'nikerunning.nike.com'});
 request.end();
 
 // on the response read the data as it is returned
 request.on('response', function(response){
 log.info(response.statusCode);
 
 response.on('data', function(data){
 log.info(data);
 responseStr += data;
 });
 
 // when the response is finished parse the data using the parser
 response.on('end', function(){
 parser.parseString(responseStr);
 });
 });

// delete me when go live
// parser.parseString(cachedXML);

// create the web server that will host the web service
http.createServer(function(request, response){
    log.info(request.connection.remoteAddress); // im watching you...
    
	// /runs is the endpoint we will expose for the webservice
    if (request.url === '/runs') {
        response.writeHead(200, {
            'Content-Type': 'application/json'
        });
		// write the json string as the response
        response.end('{"runs" : ' + parsedStr + '}');
    }
	// for any other filename that is requested return it from the filesystem
    else {
		var filename = request.url.substring(1);
        
		// read the file from the filesystem and write it as the response
		fs.readFile(filename, function(err, data){
            response.writeHead(200, {
                'Content-Type': getMimeType(request.url.substring(1))
            });
            response.end(data);
        });
    }
}).listen(81);

// a very basic mine type resolver used to set the content-type on the http response
function getMimeType(filename){
    switch (filename.substring(filename.lastIndexOf('.') + 1)) {
        case 'js':
            return 'application/x-javascript';
            break;
        case 'jpeg':
            return 'image/jpeg';
            break;
        default:
            return 'text/html';
    }
}



