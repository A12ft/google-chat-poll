import {HttpFunction} from '@google-cloud/functions-framework';
import {chat_v1 as chatV1} from '@googleapis/chat';
import CommandHandler from './handlers/CommandHandler';
import MessageHandler from './handlers/MessageHandler';
import ActionHandler from './handlers/ActionHandler';
import {generateHelpText} from './helpers/helper';
import TaskHandler from './handlers/TaskHandler';

export const app: HttpFunction = async (req, res) => {
  if (!(req.method === 'POST' && req.body)) {
    console.log('unknown access', req.hostname, req.ips.join(','), req.method, JSON.stringify(req.body));
    res.status(400).send('');
  }
  const buttonCard: chatV1.Schema$CardWithId = {
    'cardId': 'welcome-card',
    'card': {
      'sections': [
        {
          'widgets': [
            {
              'buttonList': {
                'buttons': [
                  {
                    'text': 'Create Poll',
                    'onClick': {
                      'action': {
                        'function': 'show_form',
                        'interaction': 'OPEN_DIALOG',
                        'parameters': [],
                      },
                    },
                  },
                  {
                    'text': 'Terms and Conditions',
                    'onClick': {
                      'openLink': {
                        'url': 'https://absolute-poll.yaskur.com/terms-and-condition',
                      },
                    },
                  },
                  {
                    'text': 'Contact Us',
                    'onClick': {
                      'openLink': {
                        'url': 'https://github.com/dyaskur/google-chat-poll/issues',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };
  const event = req.body;
  if (event.type === 'TASK') {
    await new TaskHandler(event).process();
    res.json('');
  }
  // console.log(JSON.stringify(event));
  console.log(event.type,
    event.common?.invokedFunction || event.message?.slashCommand?.commandId || event.message?.argumentText,
    event.user.displayName, event.user.email, event.space.type, event.space.name);
  let reply: chatV1.Schema$Message = {
    thread: event.message?.thread,
    actionResponse: {
      type: 'NEW_MESSAGE',
    },
    text: 'Hi! To create a poll, you can use the */poll* command. \n \n' +
      'Alternatively, you can create poll by mentioning me with question and answers. ' +
      'e.g *@Absolute Poll "Your Question" "Answer 1" "Answer 2"*',
  };

  // Dispatch slash and action events
  if (event.type === 'MESSAGE') {
    const message = event.message;
    if (message.slashCommand?.commandId) {
      reply = new CommandHandler(event).process();
    } else if (message.text) {
      reply = new MessageHandler(event).process();
    }
  } else if (event.type === 'CARD_CLICKED') {
    reply = await (new ActionHandler(event).process());
  } else if (event.type === 'ADDED_TO_SPACE') {
    const message: chatV1.Schema$Message = {
      text: undefined,
      cardsV2: undefined,
    };
    const spaceType = event.space.type;
    if (spaceType === 'ROOM') {
      message.text = generateHelpText();
    } else if (spaceType === 'DM') {
      message.text = generateHelpText(true);
    }

    message.cardsV2 = [buttonCard];

    reply = {
      actionResponse: {
        type: 'NEW_MESSAGE',
      },
      ...message,
    };
  }
  res.json(reply);
};


