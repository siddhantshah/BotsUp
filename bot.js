var session = { "scandir": ".analysis/" }
var ai = require('apiai')(process.env.APIAITOKEN);
var sonar = require("./sonar.js")
var botkit = require('botkit');
var docParser = require('./doc_parse.js');
var downloader = require('./downloader');
var docParserPython = require('./doc_parse_python.js');
var controller = botkit.slackbot({ debug: false });
var path = require('path');
var mkdirp = require('mkdirp');
var userRuleMap = new Map();

controller.spawn({ token: process.env.SLACKTOKEN, }).startRTM();

controller.on('file_share,direct_message,direct_mention', replyCallback);

function replyCallback(bot, message) {
  console.log(message.text);
  session.user_id = message.user;
  session.id = session.user_id + getTimeString();
  // block for analyzing code snippets
  // if message.sbutype = snippet?
  // then use the promise callbacks to process
  getAIRes(cleanString(message.text)).then(function (response) {
    var reply = response.result.fulfillment.speech; // this is a generic response returned by the bot
    var intent = response.result.metadata.intentName; // this resolves the intent name from the response
    var params = response.result.parameters; // this gets the parameters from the response
    var context = response.result.contexts;
    if (intent === 'DefMethod') {
        if (params.method_name) {
            bot.reply(message, "Which language is this?:/");
      }
    }
    else if(intent === 'Language')
    {
        console.log("language = " + params.Language + "\tmethodname   " + context[0].parameters.method_name);
        if(params.Language && context[0].parameters.method_name)
        {
            if (params.Language === 'java') {
                var result = "";
                var res = docParser.getMethodDetails(context[0].parameters.method_name);
                if (res == null || res.length == 0) {
                    result = "Sorry! I could not find any information related to this";
                }
                else {
                    result = res[0].return_type + " " + res[0].method_name + " : " + res[0].description;
                }
                bot.reply(message, result);
            }
            else if (params.Language === 'python') {
                var result = "";
                var res = docParserPython.getMethodDetails(context[0].parameters.method_name);
                if (res == null || res.length == 0) {
                    result = "Sorry! I could not find any information related to this";
                }
                else {
                    result = res[0].description;
                }
                bot.reply(message, result);
            }
        }
        else if (params.Language)
        {
            bot.reply("I know a bit about " + params.Language + ". Do you have any questions?");
        }
        
    }
    else if(intent === 'AllMethods')
    {
        if (params.method_name) {
            method = params.method_name;
            if (params.Language === 'java')
            {
                language = params.Language;
                var result = "";
                var res = docParser.getMethodDetails(method);
                if (res == null || res.length == 0) {
                    result = "Sorry! I could not find any information related to this";
                }
                else {
                    result = res[0].return_type + " " + res[0].method_name + " : " + res[0].description;
                }
                bot.reply(message, result);
            }
            else if (params.Language === 'python')
            {
                language = params.Language;
                var result = "";
                var res = docParserPython.getMethodDetails(method);
                if (res == null || res.length == 0) {
                    result = "Sorry! I could not find any information related to this";
                }
                else {
                    result = res[0].description;
                }
                bot.reply(message, result);
            }
        }
    }
    else if ( intent === 'AnalysisChoice') {
      userRuleMap.delete(session.user_id);
      bot.reply(message, reply);
      var url = ""
      var options = {};
      if (message.subtype === 'file_share') {
        url = message.file.url_private;
        options = {
          headers: {
            "Authorization": "Bearer " + process.env.SLACKBEARERTOKEN
          },
        };
      }
      else if (params.url) {
        url = params.url
      }
      processChain(url, options).then(function (body) {
     
        userRuleMap.set(session.user_id, body.issues); //storing 
        bot.reply(message, formatIssues(body.issues));
        
      });
    }
    else if (intent === 'AnalysisFeedback' && userRuleMap.get(session.user_id) != null) { // & the map contains user data
      var ruleName = userRuleMap.get(session.user_id)[(params.number == "" ? params.ordinal : params.number) - 1].rule;
      sonar.getRules(ruleName).then(function (body) {
        bot.reply(message, formatRule(body.rule.htmlDesc));
      })
    }
    else {
      bot.reply(message, reply)
    }
  })

}
function download(url, options) {
  options.directory = session.scandir + session.id,
    options.filename = path.basename(url)

  const downloadPromise = new Promise(function (resolve, reject) {
    // var success=false;
    downloader(url, options, function (err) {
      if (err) {
        console.log(err);
        reject(err);
      }
    });
    resolve(session.id);
  })
  return downloadPromise;
}

function getAIRes(query) {
  var request = ai.textRequest(query, {
    sessionId: session.user_id
  });
  const responseFromAI = new Promise(
    function (resolve, reject) {
      request.on('error', function (error) {
        reject(error);
      });
      request.on('response', function (response) {
        resolve(response);
      });
    }).catch(() => { });
  request.end();
  return responseFromAI;
}

function formatIssues(issues) {
  var allIssues = "";
  if (issues.length==0){
    return "I found no issues.";
  }
  for (var i = 0; i < (issues.length > 10 ? 10 : issues.length); i++) {
    allIssues = allIssues + "_Issue " + (i + 1) + (issues[i].line ? " on line number " + issues[i].line : "") + "_: *" + issues[i].message + "*\n";
  }
  return allIssues;
}

function getTimeString() {
  return new Date().getFullYear() + new Date().getMonth() + new Date().getDay() + new Date().getTime();
}

function cleanString(text) {
  return text.replace('<', '').replace('>', '');
}

function getIssueCount(issues) {
  console.log(issues.length);
  var count = 0
  if (!issues || issues.length > 0) {
    count = issues.length;
  }
  return count;
}

function formatRule(ruleStr) {
  return ruleStr.replace(/<h2>/g, "*").replace(/<\/h2>/g, "*").replace(/<pre>/g, "```").replace(/<\/pre>/g, "```").replace(/<p>/g, "\n").replace(/<\/p>/g, "\n");
}

function processChain(url, options) {
  return download(url, options).then(function (sess) { return sonar.analyse(sess) }).then(function (sess) { return sonar.getIssues(sess) })
}
