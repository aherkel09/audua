const templates = compileAll();


$(document).ready(function() {
  rememberChoice(); // adds click listener to checkbox
  loadUI();
});


function readCookie(cookieName) {
  let cookies = document.cookie.split(';');

  for (let c in cookies) {
    let keyValue = cookies[c].replace(' ', '').split('=');
    if (keyValue[0] === cookieName) {
      return JSON.parse(decodeURIComponent(keyValue[1]));
    }
  }

  return {};
}


function loadUI() {
  let cookies = readCookie('__session');

  if ('error' in cookies) {
    showError(cookies.error);
  } else if ('access_token' in cookies) {
    $('#error').hide();
    requestUser(cookies.access_token, templates);
  } else {
    $('#login').show();
    $('#loggedin').hide();
  }
}


function loadUser(data, templates) {
  const userTemplate = templates.user;
  const playlistTemplate = templates.playlist;
  const user_id = data.body.id;
  const audua = new Audua(user_id);

  $('#user').html(userTemplate(data.body));

  audua.getRecentlyPlayed();
  audua.getAllPlaylists().done(function(data) {
    audua.getAuduaPlaylist(data.playlists);

    $('#playlist').html(playlistTemplate({
      playlists: data.playlists.items,
    }));

    addClicks(audua);
    $('#login').hide();
    $('#loggedin').show();
  });
}


function requestUser(access_token, templates) {
  $.ajax({
    url: '/me',
    data: {
      access_token: access_token,
    },
    success: function(data) {
      if (data.body) {
        loadUser(data, templates)
      } else {
        requestRefresh();
      }
    },
    error: function(error) {
      showError(error);
    },
  });
}


function requestRefresh() {
  $.ajax({
    url: '/refresh_token',
    success: function(data) {
      if (data.body) {
        loadUI();
      } else {
        requestLogout();
      }
    },
    error: function(error) {
      showError(error);
    },
  });
}


function requestLogout() {
  $.ajax({
    url: '/logout',
    success: function(data) {
      loadUI();
    },
    error: function(error) {
      showError(error);
    },
  });
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


function showError(error) {
  $('#error-msg').text('error: ' + error);
  $('#error').show();
}


function showHelp() {
  $('#help').toggle();
}


function showDescription(choice) {
  const choices = {
    'deep-tracks': 'recently played songs will be played last',
    'random': 'your tracks ordered without rhyme or reason',
  };

  $('#shuffle-description').text('description: ' + choices[choice]);
}
