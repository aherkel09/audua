class Audua {
  constructor(user_id) {
    this.user_id = user_id;
    this.playlists = {};
    this.recents = [];
    this.audua_playlist = null;
    this.audua_href = 'https://open.spotify.com/';
    this.shuffle = null;
  }


  getRecentlyPlayed() {
    const _this = this;
    $.ajax({
      url: '/recent',
    }).done(function(data) {
      for (var t in data.tracks) {
        _this.recents.push(data.tracks[t].track.uri);
      }
    });
  }


  getAllPlaylists() {
    const _this = this;
    return $.ajax({
      url: '/playlists',
      data: {
        user_id: _this.user_id,
      }
    });
  }


  getAuduaPlaylist(playlists) {
    for (let i in playlists.items) {
      if (playlists.items[i].name === 'audua: shuffled') {
        this.audua_playlist = playlists.items[i].id;
        this.audua_href = playlists.items[i].external_urls.spotify;
        return;
      }
    }

    this.audua_playlist = null;
  }


  selectShuffle(ev) {
    $('.shuffle-option').removeClass('selected');
    $(ev.target).addClass('selected');
    this.shuffle = ev.target.id;
  }


  shufflePlaylist(playlist_id) {
    const _this = this;
    if (_this.audua_playlist) {
      this.getTracks(playlist_id, [], 0).then(function(tracks) {
        var shuffled = _this.shuffleTracks(tracks);
        _this.modifyPlaylist(shuffled);
      });
    } else {
      _this.createPlaylist().then(function(data) {
        _this.shufflePlaylist(playlist_id);
      });
    }
  }


  createPlaylist() {
    const _this = this;
    var promise = new Promise(function(resolve, reject) {
      $.ajax({
        url: '/create_playlist',
        data: {
          user_id: _this.user_id,
        },
      }).done(function(data) {
        _this.audua_playlist = data.playlist.id;
        this.audua_href = data.playlist.href;
        resolve(true);
      });
    });

    return promise;
  }


  modifyPlaylist(shuffled) {
    const _this = this;
    this.getTracks(this.audua_playlist, [], 0).then(function(tracks) {
      if (tracks.length) {
        var fiftyOrLess = Math.min(50, tracks.length);
        var begin = tracks.slice(0, fiftyOrLess);
        var end = tracks.slice(fiftyOrLess);

        return _this.removeTracks(begin).done(function(data) {
          console.log('removed tracks...');
          _this.modifyPlaylist(shuffled, end);
        });
      } else {
        return _this.addTracks(shuffled);
      }
    });
  }


  getTracks(playlist_id, retrieved, offset) {
    const _this = this;
    var promise = new Promise(function(resolve, reject) {
      $.ajax({
        url: '/tracks',
        data: {
          playlist_id: playlist_id,
          offset: offset,
        },
      }).done(function(data) {
        var items = data.tracks.items;

        for (var i in items) {
          retrieved.push({
            'uri': items[i].track.uri,
          });
        }

        if (items.length < 100) {
          resolve(retrieved);
        } else {
          _this.getTracks(playlist_id, retrieved, offset + 100).then(function(tracks) { // get next 100 tracks
            resolve(tracks);
          });
        }
      });
    });

    return promise;
  }


  addTracks(trackList) {
    const _this = this;
    var fiftyOrLess = Math.min(50, trackList.length);

    return $.ajax({
      url: '/add_tracks',
      data: {
        tracks: trackList.slice(0, fiftyOrLess),
        playlist_id: _this.audua_playlist,
      },
    }).done(function(data) {
      if (fiftyOrLess == trackList.length) {
        _this.showComplete();
      } else {
        var remaining = trackList.slice(fiftyOrLess);
        _this.addTracks(remaining);
      }
    });
  }


  removeTracks(trackList) {
    const _this = this;
    return $.ajax({
      url: '/remove_tracks',
      data: {
        tracks: JSON.stringify({uris: trackList}),
        playlist_id: _this.audua_playlist,
      },
    });
  }


  shuffleTracks(tracks) {
    var shuffled = [];
    var recentTracks = [];

    for (var t in tracks) {
      var uri = tracks[t].uri;
      if (this.shuffle === 'deep-tracks' && this.recents.includes(uri)) {
        recentTracks.push(uri);
      } else {
        shuffled.push(uri);
      }
    }

    shuffled = this.fisherYates(shuffled);
    recentTracks.reverse(); // add recently played tracks in reverse order

    for (var r in recentTracks) {
      shuffled.push(recentTracks[r]);
    }

    return shuffled;
  }


  /* implements Fisher-Yates algorithm
  ** credit: https://javascript.info/task/shuffle */
  fisherYates(array) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }


  showComplete() {
    const _this = this;
    $('#playlist-link').attr('href', _this.audua_href);
    $('#reset').click(function() {
      _this.reset();
    });
    $('#loggedin').hide();
    $('#complete').show();
  }


  reset() {
    $('.selected').removeClass('selected');
    $('#complete').hide();
    $('#loggedin').show();
  }
}
