class Audua {
  constructor(user_id) {
    this.user_id = user_id;
    this.playlists = {};
    this.recents = [];
    this.audua_playlist = null;
    this.audua_href = 'https://open.spotify.com/';
    this.shuffle = null;
    this.order = null;
  }


  // playlist functions

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


  updateAuduaPlaylist(shuffled) {
    const _this = this;
    this.getPlaylist(this.audua_playlist).then(function(trackLists) {
      _this.addTracks(shuffled);
    });
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


  shufflePlaylist(playlist_id) {
    const _this = this;
    if (_this.audua_playlist) {
      return this.getPlaylist(playlist_id).then(function(trackLists) {
        // compile tracks
        let allTracks = [];
        for (let list in trackLists) {
          if (trackLists[list].length) {
            for (let track in trackLists[list]) {
              allTracks.push(trackLists[list][track].track);
            }
          }
        }

        if (_this.shuffle.includes('feature')) {
          return _this.orderTracks(allTracks);
        } else {
          return _this.shuffleTracks(allTracks);
        }
      }).then(function(shuffled) {
        return _this.updateAuduaPlaylist(shuffled);
      }).catch(function(error) {
        console.log(error);
      });
    } else {
      return _this.createPlaylist().then(function(data) {
        return _this.shufflePlaylist(playlist_id);
      });
    }
  }


  getPlaylist(playlist_id) {
    const _this = this;
    let promise = new Promise(function(resolve, reject) {
      // initial request to get length of playlist
      _this.getTracks(playlist_id, 0).done(function(data) {
        resolve(data);
      });
    });

    return promise.then(function(data) {
      // get tracks & clear audua playlist
      return Promise.all(
        _this.generatePromises(playlist_id, (data.tracks.total))
      );
    }).catch(function(error) {
      console.log(error);
    });
  }


  generatePromises(playlist_id, numTracks) {
    const _this = this;
    let numPromises = Math.ceil(numTracks/ 100);
    let promises = [];

    for (var p=0; p<numPromises; p++) {
      let promise = new Promise(function(resolve, reject) {
        // each request to spotify api returns 100 tracks
        _this.getTracks(playlist_id, (100 * p)).done(function(data) {

          if (playlist_id === _this.audua_playlist) {
            Promise.all(_this.clearPlaylist(data.tracks.items)).then(function(data) {
              resolve([]);
            });
          } else {
            resolve(data.tracks.items);
          }

        });
      });
      promises.push(promise);
    }

    return promises;
  }


  clearPlaylist(trackList) {
    const _this = this;
    let promises = [];

    for (let t = 0; t < trackList.length; t += 50) {
      let promise = new Promise(function(resolve, reject) {
        // limit each request to 50 tracks to keep request headers short
        let subset = trackList.slice(t, Math.min(t + 50, trackList.length));
        _this.removeTracks(subset).done(function(data) {
          resolve(true);
        });
      });

      promises.push(promise);
    }
    return promises;
  }


  // track functions

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

  getTracks(playlist_id, offset) {
    return $.ajax({
      url: '/tracks',
      data: {
        playlist_id: playlist_id,
        offset: offset,
      },
    });
  }


  addTracks(trackList) {
    const _this = this;

    for (let t in trackList) {
      if (trackList[t].includes(':local:')) {
        trackList.splice(t, 1);
      }
    }

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
      } else if (trackList.length) {
        var remaining = trackList.slice(fiftyOrLess);
        _this.addTracks(remaining);
      }
    });
  }


  removeTracks(trackList) {
    const _this = this;
    let uris = [];

    for (let track in trackList) {
      uris.push(trackList[track].track.uri);
    }

    return $.ajax({
      url: '/remove_tracks',
      data: {
        uris: uris,
        playlist_id: _this.audua_playlist,
      },
    });
  }

  // TODO: add function to order >100 tracks

  orderTracks(tracks) {
    const _this = this;
    const feature = this.shuffle.split('-')[1];
    const order = this.order;
    const ids = tracks.map(function(track) {
      return track.id;
    });

    return new Promise(function(resolve, reject) {
      $.ajax({
        url: '/order_tracks',
        data: {
          ids: ids,
        },
        success: function(data) {
          let featureValues = data.info.map(function(track, index) {
            return {
              index: index,
              id: ids[index],
              value: track[feature],
            };
          });

          featureValues.sort(function(a, b) {
            return a.value - b.value;
          });

          if (order === 'desc') {
            featureValues.reverse();
          }

          resolve(featureValues.map(function(track) {
            return tracks[track.index].uri;
          }));
        },
        error: function(error) {
          reject(error);
        }
      });
    });
  }


  shuffleTracks(tracks) {
    const _this = this;

    return new Promise(function(resolve, reject) {
      let shuffled = [];
      let recentTracks = [];

      for (let t in tracks) {
        let uri = tracks[t].uri;
        if (_this.shuffle === 'deep-tracks' && _this.recents.includes(uri)) {
          recentTracks.push(uri);
        } else {
          shuffled.push(uri);
        }
      }

      shuffled = _this.fisherYates(shuffled);
      recentTracks.reverse();

      // add recently played tracks in reverse order
      for (let r in recentTracks) {
        shuffled.push(recentTracks[r]);
      }

      resolve(shuffled);
    });
  }


  // implements Fisher-Yates algorithm
  // credit: https://javascript.info/task/shuffle

  fisherYates(array) {
    for (let i = array.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
  }


  // ui functions

  selectShuffle(ev) {
    $('.shuffle-option').removeClass('selected');
    $(ev.target).addClass('selected');
    this.shuffle = ev.target.id;
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
