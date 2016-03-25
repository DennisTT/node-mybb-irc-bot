// Create the configuration
var config = {
  server: 'irc.freenode.net',
  channels: ['#mybb'],
  botName: 'MyBBot',
  nickservPassword: '',
  floodProtectionDelay: 1000
};

///////////////////////////////////////////////////////////////////////////////
// Actual bot stuff

// Get the lib
var irc = require('irc');
var request = require('request');
var cheerio = require('cheerio');
var google = require('google');
var util = require('util');
var async = require('async');

// Create the bot name
var bot = new irc.Client(config.server, config.botName, {
  channels: config.channels,
  userName: config.botName,
  floodProtection: true,
  floodProtectionDelay: config.floodProtectionDelay,
  debug: true,
  showErrors: true
});

// Listen for any channel messages
bot.addListener('message#', function (from, to, message) {
  util.log(from + ' => ' + to + ': ' + message);

  if (message.toLowerCase().indexOf('!user ') == 0 && numParams(message) >= 1) {
    var searchName = getParams(message).join(' ');
    searchUser(bot, to, searchName);
  }
  else if (message.toLowerCase().indexOf('!docs ') == 0 && numParams(message) >= 1) {
    var name = getParams(message).join(' ');
    searchDocs(bot, to, name);
  }
  else if (message.toLowerCase().indexOf('!google ') == 0 && numParams(message) >= 1) {
    var term = getParams(message).join(' ');
    searchGoogle(bot, to, term);
  }
  else if (message.toLowerCase().indexOf('!battle ') == 0 && numParams(message) >= 1 && message.toLowerCase().indexOf(' vs. ') >= 0) {
    var input = getParams(message).join(' ');
    var terms = input.split(' vs. ');
    if (terms[0] && terms[1]) {
      battle(bot, to, terms[0], terms[1]);
    }
  }
  else if (message.toLowerCase() == '!github') {
    bot.say(to, 'MyBB GitHub: ' + links.github);
  }
  else if (message.toLowerCase().indexOf('!github ') == 0 && numParams(message) >= 1) {
    var params = getParams(message);
    github(bot, to, params);
  }
  else if (message.toLowerCase() == '!twitter') {
    bot.say(to, 'MyBB Twitter: ' + links.twitter);
  }
  else if (message.toLowerCase() == '!facebook') {
    bot.say(to, 'MyBB Facebook: ' + links.facebook);
  }
  else if (message.toLowerCase() == '!help') {
    bot.say(from, 'If you need my help, send me a PM with "help"');
  }
});

// Listen to PMs
bot.addListener('pm', function (from, message) {
  util.log(from + ' => ME: ' + message);
  if (message.toLowerCase() == 'help') {
    getHelp(bot, from);
  }
  else if (message.toLowerCase() == 'about') {
    bot.say(from, 'I\'m written in Node.js and my author is DennisTT.  My source can be found at https://github.com/DennisTT/node-mybb-irc-bot');
    bot.say(from, 'Feel free to develop me, but please submit a pull request after.');
  }
  else if (message.toLowerCase() == 'hello') {
    bot.say(from, 'Hello to you too!');
  }
  else {
    bot.say(from, 'Sorry, I don\'t understand what you want.  Say "help" if you need help.');
  }
});

// On connection
bot.addListener('motd', function(message) {
  // Check name
  if (config.nickservPassword != '') {
    util.log('Recovering nickname');
    recoverNick();
  }
});

// Error handler
bot.addListener('error', function(message) {
  util.log('error: ', message);
});

// Debug response handler
//bot.addListener('raw', function (message) {
//  console.log('raw: ', message);
//});

///////////////////////////////////////////////////////////////////////////////
// Actions

var recoverNick = function() {
  bot.say('NickServ', 'identify ' + config.botName + ' ' + config.nickservPassword);
  setTimeout(function() {
    bot.say('NickServ', 'ghost ' + config.botName);
  }, 3000);
  setTimeout(function() {
    bot.say('NickServ', 'release ' + config.botName);
  }, 6000);
  setTimeout(function() {
    bot.send('NICK', config.botName);
  }, 9000);
}

var getHelp = function(bot, to) {
  bot.say(to, 'I respond to the following commands on channels:');
  bot.say(to, '!user <username> - displays some info about a user on the MyBB Community Forums');
  bot.say(to, '!docs [# results] <search term> - searches MyBB docs for search term, and returns top result (by default) or up to a maximum of 5 if specified');
  bot.say(to, '!github <repository> <pull|issue> <id> - searches the MyBB organization for a repository, pull request or issue');
  bot.say(to, '!google [# results] <search term> - searches Google for search term, and returns top result (by default) or up to a maximum of 5 if specified');
  bot.say(to, '!battle <term1> vs. <term2> - does a Google battle with number of results between term1 and term2');
  bot.say(to, '!github <repository> <pull|issue> <id> - searches the MyBB organization for a repository, pull request or issue');
  bot.say(to, '!twitter - links to the MyBB Twitter account');
  bot.say(to, '!facebook - links to the MyBB Facebook page');
  bot.say(to, 'In addition, I respond to the following commands by PM:');
  bot.say(to, 'help - this text you\'re reading');
  bot.say(to, 'about - about me');
}

var searchUser = function(bot, to, searchName) {
  util.log('Look for user: ' + searchName);

  if (searchName.toLowerCase() == "dennistt") {
    var searchName = "Dennis Tsang";
  }
  // Search the member list, hopefully the user will be somewhere within the first 300 results
  request.post('http://community.mybb.com/memberlist.php', { form: { username: searchName, perpage: 300 } }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);

      var usernamesFound = [];
      var found = false;

      $('tr').each(function(i, e) {
        var numCells = $(this).children('td').toArray().length;
        if (numCells != 7 || i < 2) {
          return;
        }

        var userRow = $(this);

        var username = userRow.children('td').eq(1).children('a').eq(0).text()
        usernamesFound.push(username);

        if (username.toLowerCase() == searchName.toLowerCase()) {
          // User matched!
          found = true;

          var profileLink = userRow.children('td').eq(1).children('a').eq(0).attr('href');
          var postCount = userRow.children('td').eq(4).text();
          var regDate = userRow.children('td').eq(2).text().split(',')[0];
          var lastVisitDate = userRow.children('td').eq(3).text().split(',')[0];
          bot.say(to, username + ': ' + postCount + ' posts on the Community Forums, last visited ' + lastVisitDate + ', member since ' + regDate + '. ' + profileLink);
        }

      });

      if (!found) {
        if (usernamesFound.length > 0) {
          bot.say(to, 'I couldn\'t find ' + searchName + ', did you mean ' + usernamesFound[Math.floor(Math.random()*usernamesFound.length)] + '?');
        }
        else {
          bot.say(to, 'I couldn\'t find ' + searchName);
        }
      }
    }
  });
}

var searchDocs = function(bot, to, term) {

  // Set number of results per page (it might come from the first word of the term)
  google.resultsPerPage = 1;
  var firstTerm = term.split(' ')[0];
  if (isNumber(firstTerm)) {
    google.resultsPerPage = Math.min(parseInt(firstTerm), 5);
    term = term.split(' ').slice(1).join(' ');
  }

  util.log('Search docs for: ' + term + ' and get ' + google.resultsPerPage + ' results');

  google(term + ' site:docs.mybb.com', function(err, next, links){
    if (err) {
      util.log(err);
      bot.say(to, 'Error fetching search results. Please try again later.');
      return;
    }

    if (links && links.length > 0)
    {
      // We want to show the lesser of what we have, or what we've specified as the limit
      for (var i = 0; i < Math.min(links.length, google.resultsPerPage); ++i) {
        var text = links[i].title;
        if (links[i].link != null) {
          text += ' - ' + links[i].link;
        }
        bot.say(to, text);
      }
    }
    else {
      bot.say(to, 'No MyBB docs results for search term: ' + term);
    }
  });
};

var searchGoogle = function(bot, to, term) {

  // Set number of results per page (it might come from the first word of the term)
  google.resultsPerPage = 1;
  var firstTerm = term.split(' ')[0];
  if (isNumber(firstTerm)) {
    google.resultsPerPage = Math.min(parseInt(firstTerm), 5);
    term = term.split(' ').slice(1).join(' ');
  }

  util.log('Search Google for: ' + term + ' and get ' + google.resultsPerPage + ' results');

  google(term, function(err, next, links){
    if (err) {
      util.log(err);
      bot.say(to, 'Error fetching search results. Please try again later.');
      return;
    }

    if (links && links.length > 0)
    {
      // We want to show the lesser of what we have, or what we've specified as the limit
      for (var i = 0; i < Math.min(links.length, google.resultsPerPage); ++i) {
        var text = links[i].title;
        if (links[i].link != null) {
          text += ' - ' + links[i].link;
        }
        bot.say(to, text);
      }
    }
    else {
      bot.say(to, 'No Google results for search term: ' + term);
    }
  });
};

var battle = function(bot, to, term1, term2) {
  util.log('Google battle: ' + term1 + ' vs. ' + term2);

  var getNumResults = function (error, response, body, callback) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);
      var resultsString = $('#resultStats').text();
      if (!resultsString)
      {
        callback(null, 0);
        return;
      }
      var matches = resultsString.match(/ [\d,]+ /);
      console.log(matches[0]);
      var string = matches[0].replace(/,/g, '');
      console.log(string);
      var number = parseInt(matches[0].replace(/,/g, ''));
      console.log(number);
      callback(null, number);
    }
    else {
      callback(error, null);
    }
  };

  async.parallel({
    '1': function (callback) {
      request.get('https://www.google.com/search?q=' + term1, function (error, response, body) {
        getNumResults(error, response, body, callback);
      });
    },
    '2': function (callback) {
      request.get('https://www.google.com/search?q=' + term2, function (error, response, body) {
        getNumResults(error, response, body, callback);
      });
    }
  },
  function (error, results) {
    if (error) {
      util.log('Google battle error: ', error);
      bot.say(to, 'Sorry, no referee showed up for this Google battle :(');
    }
    else {
      var winMessage = 'The winner is: '
      if (results['1'] > results['2']) {
        winMessage += term1;
      }
      else if (results['2'] > results['1']) {
        winMessage += term2;
      }
      else {
        winMessage = 'It was a tie!';
      }
      bot.say(to, 'GOOGLE BATTLE: ' + term1 + ' (' + results['1'] + ') vs. ' + term2 + ' (' + results['2'] + ').  ' + winMessage);
    }
  });
};

var github = function(bot, to, params) {
  var repo = params[0], //repo name
      view = params[1], //pull or issue
      id   = params[2], //pull/issue id
      viewCapital = (view) ? view.charAt(0).toUpperCase() + view.slice(1) : null;

  // go through provided parameters and generate an appropriate answer
  if(repo) {
    if(view) {
      if(view == 'pull' || view == 'issue') {
        if(view == 'issue') view = 'issues';

        if(id && isNumber(id)) { //user is requesting link to pull/issue
          bot.say(to, repo + ' ' + viewCapital + ' ' + '#' + id + ': ' + links.github + '/' + repo + '/' + view + '/' + id);
        }
        else {
          bot.say(to, errorMessage);
        }
      }
      else {
        bot.say(to, errorMessage)
      }
    }
    else { //user is requesting repo url
      bot.say(to, repo + ' repository: ' + links.github + '/' + repo);
    }
  }
  else {
    bot.say(to, errorMessage);
  }
};

///////////////////////////////////////////////////////////////////////////////
// Helpers

var numParams = function(text) {
  return text.split(' ').length-1;
};

var getParams = function(text) {
  return text.split(' ').slice(1)
}

var isNumber = function(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

///////////////////////////////////////////////////////////////////////////////
// Reusable bits of text

var errorMessage = 'Incorrect and/or missing parameters. Type !help for help.'

var links = {
  github: 'https://github.com/mybb',
  twitter: 'https://twitter.com/mybbgroup',
  facebook: 'https://www.facebook.com/MyBBoard'
}
