var https = require('https');
var fs = require('fs');

module.exports={
  pDownload: function(path,url, dest){

  var options = {
    "method": "GET",
    "hostname": "files.slack.com",
    "path": path,
    "rejectUnauthorized": "false",
    "headers": {
        "Authorization": "Bearer xoxp-256865299430-256034721060-256170554661-e9e93acfc3251d0d547cc9ca00ef1a38"
    }
  }

  var file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    var responseSent = false; // flag to make sure that response is sent only once.

    https.get(options, response => {
      response.pipe(file);
      file.on('finish', () =>{
        file.close(() => {
          if(responseSent)  return;
          responseSent = true;
          resolve();
        });
      });
    }).on('error', err => {
        if(responseSent)  return;
        responseSent = true;
        reject(err);
    });
  });
}
};

//example
//pDownload("/files-pri/T7JRF8TCN-F7KP3M34Y/download/test.js","https://sourcerershack.slack.com/files/U7J10M71S/F7KP3M34Y/test.js", "C:/Users/rgsha/Documents/Projects/SE/SlackBot/test.js")
  //.then( ()=> console.log('downloaded file no issues...'))
  //.catch( e => console.error('error while downloading', e));