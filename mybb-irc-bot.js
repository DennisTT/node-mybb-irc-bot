// Create the configuration
var config = {
  server: 'irc.freenode.net',
  channels: ['#mybb'],
	botName: 'MyBBot'
};

// Get the lib
var irc = require('irc');
var request = require('request');
var cheerio = require('cheerio');

// Create the bot name
var bot = new irc.Client(config.server, config.botName, {
  channels: config.channels,
  userName: config.botName,
  floodProtection: true,
  floodProtectionDelay: 1000
});

// Listen for any message, say to him/her in the room
bot.addListener('message', function (from, to, message) {
  console.log(from + ' => ' + to + ': ' + message);
  if (message.indexOf('!user ') == 0 && numParams(message) >= 1) {
    var searchName = getParams(message).join(' ');
    searchUser(bot, to, searchName);
  }
});

// Listen to PMs
bot.addListener('pm', function (from, message) {
  console.log(from + ' => ME: ' + message);
  if (message == 'help') {
    getHelp(bot, from);
  }
  else {
    bot.say(from, 'Sorry, I don\'t understand what you want.  Say "help" if you need help.');
  }
});

// Error handler
bot.addListener('error', function(message) {
  console.log('error: ', message);
});

///////////////////////////////////////////////////////////////////////////////
// Helpers

var numParams = function(text) {
  return text.split(' ').length-1;
};

var getParams = function(text) {
  return text.split(' ').slice(1)
}

var say = function(client, to, something) {
  console.log(something);
  if (something instanceof Array) {
    for (var i in something) {
      client.say(to, something[i]);
    }
  }
  else {
    client.say(to, something);
  }
}

///////////////////////////////////////////////////////////////////////////////
// Actions

var getHelp = function(bot, to) {
  say(bot, to, ['I respond to the following commands on channels:',
  '!user <username> - displays some info about a user on the Community Forums',
  'In addition, I respond to the following commands by PM:',
  'help - this text']);
}

var searchUser = function(bot, to, searchName) {
  console.log('Look for user: ' + searchName);
  
  request.post('http://community.mybb.com/memberlist.php', { form: { username: searchName } }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);

      // Third tr on the page
      var userRow = $('tr').eq(2);
      console.log('The row: ', userRow.html())
  
      var username = userRow.children('td').eq(1).children('a').eq(0).text()
      if (username.toLowerCase() == searchName.toLowerCase()) {
        var profileLink = userRow.children('td').eq(1).children('a').eq(0).attr('href');
        var postCount = userRow.children('td').eq(4).text();
        var regDate = userRow.children('td').eq(2).text().split(',')[0];
        bot.say(to, searchName + ' has ' + postCount + ' post(s) on the Community Forums and has been a member since ' + regDate + '. Profile: ' + profileLink);
      }
      else {
        if (username) {
          bot.say(to, 'I couldn\'t find ' + searchName + ', did you mean ' + username + '?');
        }
        else {
          bot.say(to, 'I couldn\'t find ' + searchName);
        }
      }
    }
  });

}