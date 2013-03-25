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

// Create the bot name
var bot = new irc.Client(config.server, config.botName, {
  channels: config.channels,
  userName: config.botName,
  floodProtection: true,
  floodProtectionDelay: config.floodProtectionDelay
});

// Listen for any channel messages
bot.addListener('message#', function (from, to, message) {
  console.log(from + ' => ' + to + ': ' + message);
  
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
  else if (message.toLowerCase() == '!help') {
    bot.say(from, 'If you need my help, send me a PM with "help"');
  }
});

// Listen to PMs
bot.addListener('pm', function (from, message) {
  console.log(from + ' => ME: ' + message);
  if (message.toLowerCase() == 'help') {
    getHelp(bot, from);
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
  console.log('MOTD received');
  
  // Check name
  if (config.nickservPassword != '') {
    recoverNick();
  }
});

// Error handler
bot.addListener('error', function(message) {
  console.log('error: ', message);
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
  bot.say(to, '!google [# results] <search term> - searches Google for search term, and returns top result (by default) or up to a maximum of 5 if specified');
  bot.say(to, 'In addition, I respond to the following commands by PM:');
  bot.say(to, 'help - this text you\'re reading');
}

var searchUser = function(bot, to, searchName) {
  console.log('Look for user: ' + searchName);
  
  // Search the member list, hopefully the user will be somewhere within the first 300 results
  request.post('http://community.mybb.com/memberlist.php', { form: { username: searchName, perpage: 300 } }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      $ = cheerio.load(body);
    
      var usernamesFound = [];
      var found = false;
    
      // Look at all the table rows that have 6 columns, and aren't the first 2 (headers)
      $('tr').each(function(i, e) {
        var numCells = $(this).children('td').toArray().length;
        if (numCells != 6 || i < 2) {
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
  
  console.log('Search docs for: ' + term + ' and get ' + google.resultsPerPage + ' results');
  
  google(term + ' site:docs.mybb.com', function(err, next, links){
    if (err) {
      console.error(err);
      bot.say(to, 'Error fetching search results. Please try again later.');
      return;
    }

    if (links && links.length > 0)
    {
      // We want to show the lesser of what we have, or what we've specified as the limit
      for (var i = 0; i < Math.min(links.length, google.resultsPerPage); ++i) {
        bot.say(to, links[i].title + ' - ' + links[i].link);
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
  
  console.log('Search Google for: ' + term + ' and get ' + google.resultsPerPage + ' results');
  
  google(term, function(err, next, links){
    if (err) {
      console.error(err);
      bot.say(to, 'Error fetching search results. Please try again later.');
      return;
    }

    if (links && links.length > 0)
    {
      // We want to show the lesser of what we have, or what we've specified as the limit
      for (var i = 0; i < Math.min(links.length, google.resultsPerPage); ++i) {
        bot.say(to, links[i].title + ' - ' + links[i].link);
      }
    }
    else {
      bot.say(to, 'No Google results for search term: ' + term);
    }
  });
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

