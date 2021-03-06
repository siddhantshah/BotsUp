# Service Milestone
## Introduction 
 
The service implementation of the code training bot consists of three use cases proposed in the [design](https://github.ncsu.edu/rshah8/Design-Milestone/blob/master/DESIGN.md) and two additional cases which we thought are nice to have in the application.
A video demonstration of functionality of all the cases is available [here](https://youtu.be/7Ykn8BmevRE).


## Components

The below component diagram illustrates the application flow and the inter-operation of the modules. 
![](UseCaseDiagram.jpg)

The implementation comprises of the following APIs and modules - 

#### Node.js 
Node.js is an open-source, cross-platform JavaScript run-time environment for executing JavaScript code server-side. We have used Node.js to implement the bot functionality as it is a familiar environment for us and its open source, plugin supporting functionalities are what we were looking for. Node.js allows us to use all the open source modules (botkit, sonarqube and dialogflow) that we require for the smooth functioning of the bot.

#### Botkit
The botkit NPM module allows simple integration with the slack RealTime Messaging (RTM) API and offers support for almost all the APIs supported by Slack. For the bot to detect messages from users, the following events are being monitored  - Direct_message, Direct_mention, File_share.

#### Dialogflow
Dialogflow provides AI-powered conversional interfaces that can be easily trained and integrated to any platform. The ‘apiai’ node module has been used to interface with dialogflow.   
All inputs sent by the user Slack are sent to dialogflow in order to extract an intent from the user’s natural language message. We have created the following intents:

* **Process Intents** 
   * GenericAnalysis - This intent handles the conversion that leads the user to sending a GIT url or uploading a source file or providing a code snippet
   * AnalysisChoice - This intent handles the scenario when the user directly uploads a file or provides a URL.
   * AnalysisFeedback - This intent handles the natural language ordinals a user might provide to know the details of an issue
   * DefMethod - This intent is used to intepret a method name in a natural language request
   * Language - This is used to request for a programming language name in order to process a request

* **Generic Intents** - These intents enrich the conversion with the user.
   * Greeting - Handles greetings from the user
   * Help - Handles any help requested by the user
   * Farewell - Handles goodbye messages

#### SonarQube
SonarQube is an open source platform for continuous inspection of code quality. It is mainly used to perform automatic reviews with static analysis of code to detect bugs, code smells, and security vulnerabilities on 20+ languages like Java, JavaScript, Python etc. It offers reports and recommendations on any discrepancy it finds on the analysed code.

SonarQube consists of a Scanner and a Server module. The scanner can be invoked on source files. Once the scan completes, the server module can be used to peruse the issues and recommendations. The server provides a WebAPI which we have utilized in this project.

#### Downloader
There are several options available in NPM for downloading a file. For our implementation, we require the following features 
* The Downloader should return a Promise
* It should support Authentication headers
* It should infer the file extension by the MIME type.

We borrowed these features from several modules and re-worked them into a single downloader module.

## Process Considerations

Below are insights on how some process related requirements were handled.

#### Asynchronous Event Handling

All the asynchronous operations - downloading, scanning and retrieving results are handled using JavaScript Promises. These Promises are chained to make sure asynchronous operations are called one after the other. 

In Sonarqube, there is a small delay between the completion of scan and the availability of the results on the server. Therefore, the results cannot be obtained right after the scan is complete, even while using Promises. Instead, we poll the server’s web api for the status of the scan. Once a valid status is available, we can start retrieving the results.

#### Session Handling

The following measures have been taken to ensure multiple users can use the application without conflicts.- A session ID is generated using the User Id value from Slack and a unique timestamp. The Slack User Id value is used as a session Id for Dialogflow API calls to prevent any intent conflicts between multiple users. All downloads and scans take place in separate directories that are named after the session Id. Additionally, each SonarQube scan instance is invoked with the current user’s session Id

#### Error Handling

All errors in the process chain are redirected to the bot. The bot provides a natural language response when a request cannot be processed. The administrator can review the logs to understand more about an issue.

## Use Cases
The use cases are illustrated in the below flow chart - 

![](Flow_Diagram.png)

**Use Case 1 - Analysing a source file in a GIT repository**

The user can directly provide a Git URL to the bot. He can also talk to the bot to ‘analyze code’ or ‘analyze the code from a Git repository’; the conversion will lead to the user entering the Git URL. The downloader module will then download the file and place it in the appropriate session directory, the Sonarqube scanner scans the source files and the bot produces the results. The user can now enter the issue number to know more about an issue. 


**Use Case 2 - Analysing a source file**

This is similar to Use Case 1; the user can directly upload a file to Slack to trigger a scan or can converse with the bot and upload the file. The subsequent operations are exactly the same as Use Case 1.

**Use Case 3 - Requesting for method definitions**

A user can request for method definitions via natural language. For example - ‘what does toString mean’ or ‘explain hashCode in Java’. The bot will request for a language name when required. Based on the intent returned by Dialogflow for these sentences, the document parser module is invoked. It scans the language documentation files and returns the result.

**Additional Use Cases**

These are additional features that further improve the functionality of the bot. 

**Use Case 4 - Analyzing code snippets**

Normally, a user can use Slack’s snippet feature to submit code. This type of a submission is treated as a file upload by Slack. Due to the API limitation on Slack, a user, other than the bot owner, cannot upload a file to the bot as a direct message. To overcome this limitation, a user can submit code around triple backticks (```) to trigger a scan. Once the scan completes, issues are displayed as expected.

**Use Case 5 - Analyzing zip archives**

A user can upload or point to a URL of a zip archive; typically this can be a clone of a Git repository. Once the zip archive is downloaded, it is extracted in the session directory and the scan takes place.

## Limitations 

The following are the limitations of the bot which we have found during our development. These limitations do not constrain the bot from its main functions to a great extent and allows the user to get what is expected from the bot.

* Slack cannot authorize the bot to download files on Direct Message. Hence, files uploaded on direct message to the bot will not be downloaded, and hence, won’t be analysed (unless you are the owner of the bot). In order to make the bot analyse files, you must send the file on any of the slack channel where the bot is a member, along with @”bot_name” in the description of the file.
* Sonarqube does not scan projects having multiple java files without their binaries (.class files). This can be overcome in future using the mvn sonar:sonar command, but is not in the scope of the current project. 
See [documentation](https://docs.sonarqube.org/display/PLUG/SonarJava).
* Documentation module tells you the description of basic functions. Conceptual knowledge is not expected. The Documentation module supports only Java and Python functions for now.
* The bot only gives out the first 10 issues to avoid long messages in chat window. This is not a limitation but we thought it is better to mention this here. In order to access the other issues in the files, the user will need to solve the first 10 issues and then send the code for analysis again (for this milestone).
* Performance of the bot might be impacted when multiple users try to analyse their code/projects simultaneously. Both the project outputs will be queued and displayed when both operations are over. This is because javascript is not multithreaded.


## Future improvements 

* For Java projects (having multiple java files), we could have Maven builds performed by the bot using `mvn sonar:sonar` command which builds the java project, analyses the binaries and gives us the reports on the SonarQube server. This was not implemented as the command does not take in SessionIDs as a parameter. Need to find some work around for this. Currently this feature is out of scope for the Service Milestone.
* The bot can show all the issues in a file. However, we are displaying only the first 10 issues to the user to avoid clutter. In this case, we could sort the issues in the order of severity and then display the top 10 most severe issues in the given file(s). Current Scenario in Service Milestone: 10 Issues in the order of line numbers are displayed.

## References
1. [BotKit Repo](https://github.com/howdyai/botkit)
2. [DialogFlow Repo](https://github.com/dialogflow/dialogflow-nodejs-client)
3. [SonarQube Wiki](https://en.wikipedia.org/wiki/SonarQube), [SonarQube Homepage](https://www.sonarqube.org/)
4. [File Downloader](https://www.npmjs.com/package/download-file)
