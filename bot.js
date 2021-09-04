// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.qnaMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);
      
        // create a IntentRecognizer connector
        this.intentRecogniser = new IntentRecognizer(configuration.LuisConfiguration);


        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnaMaker.getAnswers(context);
          
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.intentRecogniser.executeLuisQuery(context);
                     
            // determine which service to respond with based on the results from LUIS
            if (LuisResult.luisResult.prediction.topIntent == 'GetAvailability' &&
                LuisResult.intents.GetAvailability.score > 0.75 &&
                LuisResult.entities.$instance){
                    const availableTime = await this.dentistScheduler.getAvailability();
                    await context.sendActivity(availableTime);
                    next();
                    return;
            }

            if (LuisResult.luisResult.prediction.topIntent == 'ScheduleAppointment' &&
                LuisResult.intents.ScheduleAppointment.score > 0.75 &&
                LuisResult.entities.$instance && 
                LuisResult.entities.$instance.datetime &&
                LuisResult.entities.$instance.datetime[0]){
                    const time = LuisResult.entities.$instance.datetime[0].text;
                    const schedulerResponse = await this.dentistScheduler.scheduleAppointment(time);
                    await context.sendActivity(schedulerResponse);
                    next();
                    return;
            }

            if(qnaResults[0]){
                console.log(qnaResults[0])
                await context.sendActivity(`${qnaResults[0].answer}`);
            }

            else{
                await context.sendActivity(`Sorry, I did not find an answer to your question.`);
            }
     
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Hello, I am dova. A virtual assistant for dental office';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
