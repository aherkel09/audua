function showHelp() {
  $('#help').toggle();
}


function showError(error) {
  $('#error-msg').text('error: ' + error);
  $('#error').show();
}


function showDescription(choice) {
  const choices = {
    'deep-tracks': 'recently played songs will be played last',
    'random': 'your tracks ordered without rhyme or reason',
  };

  $('#shuffle-description').text('description: ' + choices[choice]);
}


function compileTemplate(name) {
  const source = $('#' + name + '-template').html();
  return Handlebars.compile(source);
}

function compileAll() {
  return {
    user: compileTemplate('user'),
    playlist: compileTemplate('playlist'),
  };
}


function readCookie(cookieNum) {
  let cookies = document.cookie.split(';');
  for (let c in cookies) {
    let keyValue = cookies[c].replace(' ', '').split('=');
    if (keyValue[0] === '__session') {
      let cookieSet = keyValue[1].split('???');
      return cookieSet[cookieNum];
    }
  }

  return null;
}


function rememberChoice() {
  $('#remember-me').click(function() {
    if ($('#remember-me').attr('value') === 'true') {
      $('#login-btn').attr('href', '/login?remember=true');
      $('#remember-me').attr('value', 'false');
    } else {
      $('#login-btn').attr('href', '/login');
      $('#remember-me').attr('value', 'true');
    }
  });
}


function addClicks(audua) {
  $('.shuffle-option').click(function(ev) {
    audua.selectShuffle(ev);
    showDescription(ev.target.id);
    $('#playlist-container').show();
  })

  $('.playlist-name').click(function(ev) {
    audua.shufflePlaylist(ev.target.id);
  });
}


function loadProfile(access_token, templates) {
  const userTemplate = templates.user,
      playlistTemplate = templates.playlist;

  $.ajax({
    url: '/me',
    data: {
      access_token: access_token,
    },
  }).done(function(data) {
    const user_id = data.body.id;
    $('#user').html(userTemplate(data.body));

    const audua = new Audua(user_id, access_token);
    audua.getRecentlyPlayed();

    audua.getAllPlaylists().done(function(data) {
      audua.getAuduaPlaylist(data.playlists);
      $('#playlist').html(playlistTemplate({
        playlists: data.playlists.items,
      }));
      addClicks(audua);
    });
  });
}


$(document).ready(function() {
  var templates = compileAll();
  rememberChoice();

  var access_token = readCookie(0),
      refresh_token = readCookie(1),
      error = readCookie(2);

  if (error) {
    showError(error);
  } else {
    $('#error').hide();

    if (access_token) {
      loadProfile(access_token, templates);
      $('#login').hide();
      $('#loggedin').show();
    } else if (refresh_token) {
      $.ajax({
        url: '/refresh_token',
      });
    } else {
      $('#login').show();
      $('#loggedin').hide();
    }
  }
});
