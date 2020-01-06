const express = require('express');
const request = require('request');
const path = require('path');
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

const redirect_uri = uri_choices.production;

var generateRandomString = (length) => {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const app = express();

app.use(cookieParser())
  .use(cors())
  .use(express.static(path.join(__dirname, '/public')));


// app routes

app.get('/login', (req, res) => {
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


app.get('/logout', (req, res) => {
  res.clearCookie('__session')
    .redirect('/');
});


app.get('/callback', (req, res) => {
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies.__session : null;

  if (state === null || state !== storedState) {
    res.cookie('__session', JSON.stringify({error: 'state_mismatch'}))
      .redirect('/');
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

    request.post(options, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        var cookie = {
          access_token: body.access_token,
        };

        if (state.split('_')[1] === 'true') {
          cookie['refresh_token'] = body.refresh_token;
        }

        res.cookie('__session', JSON.stringify(cookie))
          .set('Cache-Control', 'private')
          .redirect('/');
      }
    });
  }
});


app.get('/refresh_token', (req, res) => {
  let cookie = req.cookies.__session

  if (!req.cookies.__session) {
    res.redirect('/logout');
  } else {
    let refresh_token = JSON.parse(cookie).refresh_token;

    var options = {
      url: 'https://accounts.spotify.com/api/token',
      headers: { 'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64')) },
      form: {
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      },
      json: true
    };

    request.post(options, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        let cookie = {
          access_token: body.access_token,
          refresh_token: refresh_token
        };

        res.cookie('__session', JSON.stringify(cookie))
          .send({body});
      } else {
        res.redirect('/logout');
      }
    });
  }
});


app.get('/me', (req, res) => {
  var access_token = JSON.parse(req.cookies.__session).access_token;

  var options = {
    url: 'https://api.spotify.com/v1/me',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.send({body});
    } else {
      res.redirect('/logout');
    }
  });
});


app.get('/recent', (req, res) => {
  var access_token = JSON.parse(req.cookies.__session).access_token;
  var limit = {limit: 50};

  var options = {
    url: 'https://api.spotify.com/v1/me/player/recently-played',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    data: limit,
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.send({
        tracks: body.items,
      });
    }
  });
});


app.get('/playlists', (req, res) => {
var access_token = JSON.parse(req.cookies.__session).access_token;

  var options = {
    url: 'https://api.spotify.com/v1/me/playlists',
    headers: {
      'Authorization': 'Bearer ' + access_token,
    },
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.send({
        'playlists': body,
      });
    }
  });
});


app.get('/create_playlist', (req, res) => {
  var user_id = req.query.user_id;
  var access_token = JSON.parse(req.cookies.__session).access_token;

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

  request.post(options, (error, response, body) => {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      var playlist = JSON.parse(body);
      res.send({playlist});
    }
  });
});

app.get('/tracks', (req, res) => {
  var access_token = JSON.parse(req.cookies.__session).access_token;
  var playlist_id = req.query.playlist_id;
  var offset = req.query.offset;

  var options = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?offset=' + offset + '&fields=total,items(track(uri))',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.send({
        tracks: body,
      });
    }
  });
});


app.get('/add_tracks', (req, res) => {
  var access_token = JSON.parse(req.cookies.__session).access_token;
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

  request.post(options, (error, response, body) => {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      res.send({
        body: body,
      });
    }
  });
});


app.get('/remove_tracks', (req, res) => {
  var access_token = JSON.parse(req.cookies.__session).access_token;
  var playlist_id = req.query.playlist_id;
  var trackList = [];
  var uris = req.query.uris;

  for (var u in uris) {
    trackList.push({uri: uris[u]});
  }

  var tracks = {tracks: trackList};

  var options = {
    url: 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks',
    headers: {
      'Authorization': 'Bearer ' + access_token,
      'Content-Type': 'application/json',
    },
    body: tracks,
    json: true,
  };

  request.delete(options, (error, response, body) => {
    if (!error && (response.statusCode === 200 || response.statusCode === 201)) {
      res.send({
        body: body,
      });
    }
  });
});


exports.app = functions.https.onRequest(app);
