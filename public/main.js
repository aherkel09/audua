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


function changeOrder(ev) {
  let btn = ev.target.id;
  if (btn === 'asc') {
    $('#desc').removeClass('orange');
    $('#asc').addClass('orange');
    $('#order-input').attr('value', 'asc');
  } else {
    $('#asc').removeClass('orange');
    $('#desc').addClass('orange');
    $('#order-input').attr('value', 'desc');
  }
}


function getOrder() {
  return $('#order-input').attr('value');
}


function addClicks(audua) {
  $('.shuffle-option').click(function(ev) {
    audua.selectShuffle(ev);
    showDescription(ev.target.id);
    $('#playlist-container').show();
  });

  $('.shuffle-option:not(.order)').click(function(ev) {
    $('#order-options').hide();
  })

  $('.order').click(function(ev) {
    $('#order-options').show();
  })

  $('.playlist-name').click(function(ev) {
    audua.order = getOrder();
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
    'deep-tracks': 'hear the tracks you\'ve neglected. those 3 songs you listen to every day can wait.',
    'random': 'your tracks ordered without rhyme or reason.',
    'feature-acousticness': 'put acoustic songs first (or last).',
    'feature-danceability': 'start a dance party, or avoid one entirely.',
    'feature-duration_ms': 'decide when that 26-minute power ballad you forgot you added should play.',
    'feature-energy': 'going up? coming down? this will move the mood in the right direction.',
    'feature-instrumentalness': 'want more cowbell? maybe less? this method has you covered.',
    'feature-key': 'climb up the scale from C, or come down from B.',
    'feature-liveness': 'when do you wanna hear that live version with the 12-minute tuba solo?',
    'feature-loudness': 'fade in or fade out.',
    'feature-tempo': 'pump the accelerator (or the brakes) as needed.',
    'feature-time_signature': 'sort by the number of beats per measure.',
    'feature-valence': 'good news first? bad news first? take your pick.'
  };

  $('#description-text').text(choices[choice]);
  $('#shuffle-description').show();
}

function showQuestions() {
  $('#faq').toggle();
}
