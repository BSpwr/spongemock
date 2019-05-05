'use strict';

const request = require('request-promise');
const qs = require('querystring');
const url = require('url');
const he = require('he');

const SPONGE_EMOJI = ':spongemock:';
//clientID and clientSecret only needed to generate userToken
const clientID = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;
//Authorization will put this token into console, grab it and put it into serverless.yml for spongemock to work
const userToken = process.env.USER_TOKEN;

//Getting a new user token
module.exports.authorization = (event, context, callback) => {
  const code = event.queryStringParameters.code;
 
  console.log('Authorization called');
  const oauthURL = url.format({
    protocol: 'https',
    hostname: 'slack.com/api',
    pathname: 'oauth.access',
    query: {
      client_id: clientID,
      client_secret: clientSecret,
      code: code
      },
  });

  const options = {
      url: oauthURL,
      json: true,
  };

  return request(options).then((response) => {
      console.log(`USER_ACCESS_TOKEN: ${response.access_token}`)
  })
  .catch((error) => {
      console.log(error);
  })
  //Callback here
  .then(() => {
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Authorization has completed',
          input: event,
        }),
      };
      callback(null, response);
  })
  .catch((error) => {
      console.log(error);
      const response = {
        statusCode: 500,
        body: JSON.stringify({
          message: error,
          input: event,
        }),
      };
      callback(null, response);
  });
};

//(/spongemock) entrypoint
module.exports.spongemock = (event, context, callback) => {
  const params = qs.parse(event.body);
  const parseSlackTokenRegex = /(<@?#?!?[^>]+>)/g;
  
  //If spongemock without text input
  if (!params.text) {
    slackGET('conversations.history', {channel: params.channel_id, limit: 1})
    .then((res) => {
      let message = JSON.parse(res).messages[0]['text'];
      console.log(`Spongemock called by: ${params.user_name } with message: ${message}`);
      let processedMessage = `${SPONGE_EMOJI} ${parsingHelper(message, spongemockify).join('')} ${SPONGE_EMOJI}`;
      sendJSON_POST(processedMessage, params.response_url);
    })
    .catch((error) => console.log(`Spongemock w/o text error: ${error}`));
  }
  //Use provided command input
  else {
    console.log(`Spongemock called by: ${params.user_name} with message: ${params.text}`);
    let processedMessage = `${SPONGE_EMOJI} ${parsingHelper(params.text, spongemockify).join('')} ${SPONGE_EMOJI}`;
    sendJSON_POST(processedMessage, params.response_url);
  }

  const response = {
    statusCode: 200,
    body: "",
  };
  callback(null, response);
};

//(/lettermock) entrypoint
module.exports.lettermock = (event, context, callback) => {
  const params = qs.parse(event.body);
  const parseSlackTokenRegex = /(<@?#?!?[^>]+>)/g;
  
  //If lettermock without text input
  if (!params.text) {
    slackGET('conversations.history', {channel: params.channel_id, limit: 1})
    .then((res) => {
      let message = JSON.parse(res).messages[0]['text'];
      console.log(`Lettermock called by: ${params.user_name } with message: ${message}`);
      let processedMessage = parsingHelper(message, lettermockify).join('');
      sendJSON_POST(processedMessage, params.response_url);
    })
    .catch((error) => console.log(`Lettermock w/o text error: ${error}`));
  }
  //Use provided command input
  else {
    console.log(`Lettermock called by: ${params.user_name} with message: ${params.text}`);
    let processedMessage = parsingHelper(params.text, lettermockify).join('');
    sendJSON_POST(processedMessage, params.response_url);
  }

  const response = {
    statusCode: 200,
    body: "",
  };
  callback(null, response);
};

//Handles parsing @user and #channel tags as well as emoji, and running mockfunction on everything else
//Then it returns the array of elements
let parsingHelper = (str, mockfunction) => {
  str = he.decode(str);
  const regex = /(:[^\s:]*:)|(<@?#?!?[^>]+>)/g;
  let indexStart = [];
  let indexEnd = [];
  let match;
  while (match = regex.exec(str)) {
    indexStart.push(match.index);
    indexEnd.push(regex.lastIndex);
  }
  let lastIndex = 0;
  let strArr = [];
  //If no @user or #channel then run mockfunction and return
  if (indexStart.length == 0) {
    strArr.push(mockfunction(str));
    return strArr;
  }
  //Else parse
  for (let i = 0; i < indexStart.length; i++) {
    strArr.push(mockfunction(str.substring(lastIndex, indexStart[i])));
    lastIndex = indexEnd[i];
    let parsed = str.substring(indexStart[i], indexEnd[i])
    let exempt = {
      '<!channel>': ':channel_1::channel_2::channel_3:',
      '<!everyone>': '@everyone',
      '<!here>': '@here',
    };
    if (exempt[parsed] != undefined)
      strArr.push(exempt[parsed]);
    else
      strArr.push(parsed);
    if (i == indexStart.length - 1)
      strArr.push(mockfunction(str.substring(indexEnd[i])));
  }
  return strArr;
}

//string -> StRiNg, iqiq -> iQiQ, llql -> LLqL, lqql -> LqQl
let spongemockify = (str) => {
  console.log(`Spongemockify called with message: ${str}`);
  let ret = "";
  let spongeBool = 1;
  for (let i = 0; i < str.length - 1; i++) {
    if (str.charAt(i) == "i" || str.charAt(i) == "I") {
      ret += "i";
      spongeBool = 1;
      continue;
    }
    else if ( (str.charAt(i) == "L" || str.charAt(i) == "l") && (str.charAt(i+1) == "L" || str.charAt(i+1) == "l") ) {
      ret += "LL";
      i++;
      spongeBool = 0;
      continue;
    }
    else if (spongeBool) {
      ret += str.charAt(i).toUpperCase();
      spongeBool = 0;
    }
    else {
      ret += str.charAt(i).toLowerCase();
      spongeBool = 1;
    }
  }
  if (str.length != ret.length) {
    if (spongeBool) {
      ret += str.charAt(str.length - 1).toUpperCase();
      spongeBool = 0;
    }
    else {
      ret += str.charAt(str.length - 1).toLowerCase();
      spongeBool = 1;
    }
  }
  return ret;
};

//Converts alphanumeric string into emoji
let lettermockify = (str) => {
  console.log(`Lettermockify called with message: ${str}`);
  str = str.toLowerCase();
  const regex = /([^0-9a-z\s]*)/g;
  str = str.replace(regex, '');
  let alphanumeric = {
    ' ': '      ',
    '0': ':zero:',
    '1': ':one:',
    '2': ':two:',
    '3': ':three:',
    '4': ':four:',
    '5': ':five:',
    '6': ':six:',
    '7': ':seven:',
    '8': ':eight:',
    '9': ':nine:',
    'a': ':letter_a:',
    'b': ':letter_b:',
    'c': ':letter_c:',
    'd': ':letter_d:',
    'e': ':letter_e:',
    'f': ':letter_f:',
    'g': ':letter_g:',
    'h': ':letter_h:',
    'i': ':letter_i:',
    'j': ':letter_j:',
    'k': ':letter_k:',
    'l': ':letter_l:',
    'm': ':letter_m:',
    'n': ':letter_n:',
    'o': ':letter_o:',
    'p': ':letter_p:',
    'q': ':letter_q:',
    'r': ':letter_r:',
    's': ':letter_s:',
    't': ':letter_t:',
    'u': ':letter_u:',
    'v': ':letter_v:',
    'w': ':letter_w:',
    'x': ':letter_x:',
    'y': ':letter_y:',
    'z': ':letter_z:',
    '\n': '\n\n',
  };
  let ret = "";
  for (let i in str)
    ret+= alphanumeric[str[i]];
  return ret;
};

//GET a slack method
let slackGET = (endpoint, params) => {
  console.log(`SlackGET called with endpoint: ${endpoint}, params: ${JSON.stringify(params)}`);
  const apiURL = url.format({
    protocol: 'https',
    hostname: 'slack.com/api',
    pathname: endpoint,
    query: Object.assign({ 'token': userToken }, params),
  });
  console.log(`SlackGET URL: ${apiURL}`);
  return request(apiURL);
}

//POST with body formatted as JSON
let sendJSON_POST = (message, response_url) => {
  console.log(`sendJSON_POST called with message: ${message}, response_url: ${response_url}`);
  const options = {
    method: 'POST',
    url: response_url,
    body: {
      'response_type': 'in_channel',
      'text': message,
    },
    headers: {
      'Content-Type': 'application/json',
    },
    json: true,
  };
  request(options).then(res => console.log(`sendJSON_POST: ${res}`))
  .catch((error) => console.log(`sendJSON_POST error: ${error}`));
}