const express = require('express');
const request = require('request');
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

const functions = require('firebase-functions');
const config = functions.config();

const client_id = config.spotify.id;
const client_secret = config.spotify.secret;

const uri_choices = {
  local: 'http://localhost:5000/callback',
  production: 'https://audua.link/callback',
};

const redirect_uri = uri_choices.local;

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var setError = function(res, msg) {
  res.cookie('__session', ' ??? ???' + msg)
    .set('Cache-Control', 'private')
    .redirect('/');
};

const app = express();

app.use(cookieParser())
  .use(cors())
  .use(express.static(__dirname + '/public'));


// app routes

app.get('/login', function(req, res) {
  var rememberMe = req.query.remember || 'false';
  var state = generateRandomString(16) + '_' + rememberMe;
  var scope = 'user-read-private user-read-email user-read-recently-played playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';

  res.cookie('__session', state, {overwrite: true})
    .set('Cache-Control', 'private')
    .redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      }));
});


app.get('/logout', function(req, res) {
  res.clearCookie('__session')
    .redirect('/');
});


app.get('/callback', function(req, res) {
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies.__session : null;

  if (state === null || state !== storedState) {
    setError(res, 'state_mismatch');
  } else {
    var options = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(options, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token;

        if (state.split('_')[1] === 'true') {
          access_token = access_token + '???' + body.refresh_token;
        }

        res.cookie('__session', access_token)
          .set('Cache-Control', 'private')
          .redirect('/');
      } else {
        setError(res, 'invalid_token');
      }
    });
  }
});


app.get('/refresh_token', function(req, res) {
  var refresh_token = req.cookies.__session.split('???')[1];

  var options = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.cookie('__session', access_token + '???' + refresh_token)
        .set('Cache-Control', 'private')
        .redirect('/');
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/me', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];

  var options = {
    url: 'https://api.spotify.com/v1/me',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    json: true,
  };

  request.get(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send({body});
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/recent', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];
  var limit = JSON.stringify({limit: 50});

  var options = {
    url: 'https://api.spotify.com/v1/me/player/recently-played',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    data: limit,
    json: true,
  };

  request.get(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send({
        tracks: body.items,
      });
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/playlists', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];

  var options = {
    url: 'https://api.spotify.com/v1/me/playlists',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    json: true,
  };

  request.get(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send({
        'playlists': body,
      });
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/create_playlist', function(req, res) {
  var user_id = req.query.user_id;
  var access_token = req.cookies.__session.split('???')[0];

  var info = JSON.stringify({
    name: 'audua: shuffled',
    description: 'playlist created with audua',
  });

  var options = {
    url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: info,
  };

  request.post(options, function(error, response, body) {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      var playlist = JSON.parse(body);
      res.send({playlist});
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/tracks', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];
  var playlist_id = req.query.playlist_id;
  var offset = req.query.offset;

  var options = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?offset=' + offset + '&fields=items(track(uri))',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    json: true,
  };

  request.get(options, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      res.send({
        tracks: body,
      });
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/add_tracks', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];
  var tracks = req.query.tracks;
  var playlist_id = req.query.playlist_id;

  var options = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: tracks,
    json: true,
  };

  request.post(options, function(error, response, body) {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      res.send({
        body: body,
      });
    } else {
      setError(res, response.statusMessage);
    }
  });
});


app.get('/remove_tracks', function(req, res) {
  var access_token = req.cookies.__session.split('???')[0];
  var playlist_id = req.query.playlist_id;
  var trackList = [];
  var tracks = req.query.tracks;

  for (var t in tracks) {
    trackList.push(tracks[t]);
  }

  tracks = JSON.stringify({'tracks': trackList});

  var options = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: tracks,
    json: true,
  };

  request.delete(options, function(error, response, body) {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      res.send({
        body: body,
      });
    } else {
      setError(res, response.statusMessage);
    }
  });
});


exports.app = functions.https.onRequest(app);
