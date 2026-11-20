package expo.modules.youtubeengine

import com.grack.nanojson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class MusicBrowseTest {

  @Test
  fun `parseRichSearch extracts top artist, inherits artist onto nested card tracks, and separates albums and playlists`() {
    val json = JsonParser.`object`().from(
      """
      {
        "contents": {
          "tabbedSearchResultsRenderer": {
            "tabs": [{
              "tabRenderer": {
                "content": {
                  "sectionListRenderer": {
                    "contents": [
                      {
                        "musicCardShelfRenderer": {
                          "title": {
                            "runs": [{
                              "text": "Vicente Fernández",
                              "navigationEndpoint": {
                                "browseEndpoint": {
                                  "browseId": "UChYPL8XRXNqerL5hLkd9E9g",
                                  "browseEndpointContextSupportedConfigs": {
                                    "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_ARTIST" }
                                  }
                                }
                              }
                            }]
                          },
                          "subtitle": { "runs": [{ "text": "Artist • 47.4M monthly audience" }] },
                          "thumbnail": { "musicThumbnailRenderer": { "thumbnail": { "thumbnails": [{ "url": "https://img/art.jpg", "width": 226 }] } } },
                          "contents": [
                            {
                              "musicResponsiveListItemRenderer": {
                                "playlistItemData": { "videoId": "LDv8iVUj_Os" },
                                "flexColumns": [
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "No Me Hagas Menos" }] } } },
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Song" }, { "text": " • " }, { "text": "2:57" }] } } }
                                ]
                              }
                            }
                          ]
                        }
                      },
                      {
                        "itemSectionRenderer": {
                          "contents": [
                            {
                              "musicResponsiveListItemRenderer": {
                                "navigationEndpoint": {
                                  "browseEndpoint": {
                                    "browseId": "MPREb_ckLfEPIIv5v",
                                    "browseEndpointContextSupportedConfigs": {
                                      "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_ALBUM" }
                                    }
                                  }
                                },
                                "flexColumns": [
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Por Tu Maldito Amor" }] } } },
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Album • Vicente Fernández • 1990" }] } } }
                                ]
                              }
                            },
                            {
                              "musicResponsiveListItemRenderer": {
                                "navigationEndpoint": {
                                  "browseEndpoint": {
                                    "browseId": "VLPLC91ADB8ACE3C4E3C",
                                    "browseEndpointContextSupportedConfigs": {
                                      "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_PLAYLIST" }
                                    }
                                  }
                                },
                                "flexColumns": [
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Mejores canciones" }] } } },
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Playlist • mack • 187M views" }] } } }
                                ]
                              }
                            },
                            {
                              "musicResponsiveListItemRenderer": {
                                "playlistItemData": { "videoId": "Cbtgk20s6wA" },
                                "flexColumns": [
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Concert Video" }] } } },
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Video • Vicente Fernández" }] } } }
                                ]
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              }
            }]
          }
        }
      }
      """.trimIndent()
    )

    val rich = MusicSearch.parseRichSearch(json, 20)
    assertEquals(true, rich["explicitKnown"])

    val topArtist = rich["topArtist"] as? Map<*, *>
    assertNotNull(topArtist)
    assertEquals("UChYPL8XRXNqerL5hLkd9E9g", topArtist!!["browseId"])
    assertEquals("Vicente Fernández", topArtist["name"])

    val tracks = rich["tracks"] as List<Map<*, *>>
    assertEquals(1, tracks.size)
    assertEquals("LDv8iVUj_Os", tracks[0]["id"])
    assertEquals("Vicente Fernández", tracks[0]["artist"])
    assertEquals(false, tracks[0]["explicit"])

    val albums = rich["albums"] as List<Map<*, *>>
    assertEquals(1, albums.size)
    assertEquals("MPREb_ckLfEPIIv5v", albums[0]["browseId"])
    assertEquals("1990", albums[0]["year"])
    assertEquals("Album", albums[0]["albumType"])

    val playlists = rich["playlists"] as List<Map<*, *>>
    assertEquals(1, playlists.size)
    assertEquals("VLPLC91ADB8ACE3C4E3C", playlists[0]["browseId"])
    assertEquals("mack", playlists[0]["author"])
  }

  @Test
  fun `parseArtistProfile extracts top songs, explicit subtitleBadges on albums, singles, playlists, and related artists`() {
    val json = JsonParser.`object`().from(
      """
      {
        "header": {
          "musicImmersiveHeaderRenderer": {
            "title": { "runs": [{ "text": "Eminem" }] },
            "monthlyListenerCount": { "runs": [{ "text": "244M monthly audience" }] },
            "thumbnail": { "musicThumbnailRenderer": { "thumbnail": { "thumbnails": [{ "url": "https://img/em.jpg", "width": 544 }] } } }
          }
        },
        "contents": {
          "singleColumnBrowseResultsRenderer": {
            "tabs": [{
              "tabRenderer": {
                "content": {
                  "sectionListRenderer": {
                    "contents": [
                      {
                        "musicShelfRenderer": {
                          "title": { "runs": [{ "text": "Top songs" }] },
                          "bottomEndpoint": { "browseEndpoint": { "browseId": "VLOLAK5uy_top" } },
                          "contents": [
                            {
                              "musicResponsiveListItemRenderer": {
                                "playlistItemData": { "videoId": "zlJ0Aj9y67c" },
                                "badges": [{ "musicInlineBadgeRenderer": { "icon": { "iconType": "MUSIC_EXPLICIT_BADGE" } } }],
                                "flexColumns": [
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Lose Yourself" }] } } },
                                  { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Eminem" }] } } }
                                ]
                              }
                            }
                          ]
                        }
                      },
                      {
                        "musicCarouselShelfRenderer": {
                          "header": { "musicCarouselShelfBasicHeaderRenderer": { "title": { "runs": [{ "text": "Albums" }] } } },
                          "contents": [
                            {
                              "musicTwoRowItemRenderer": {
                                "title": { "runs": [{ "text": "The Eminem Show" }] },
                                "subtitle": { "runs": [{ "text": "2002" }] },
                                "subtitleBadges": [{ "musicInlineBadgeRenderer": { "icon": { "iconType": "MUSIC_EXPLICIT_BADGE" } } }],
                                "navigationEndpoint": {
                                  "browseEndpoint": {
                                    "browseId": "MPREb_emshow",
                                    "browseEndpointContextSupportedConfigs": {
                                      "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_ALBUM" }
                                    }
                                  }
                                }
                              }
                            }
                          ]
                        }
                      },
                      {
                        "musicCarouselShelfRenderer": {
                          "header": { "musicCarouselShelfBasicHeaderRenderer": { "title": { "runs": [{ "text": "Featured on" }] } } },
                          "contents": [
                            {
                              "musicTwoRowItemRenderer": {
                                "title": { "runs": [{ "text": "Presenting Eminem" }] },
                                "subtitle": { "runs": [{ "text": "Playlist • YouTube Music" }] },
                                "navigationEndpoint": {
                                  "browseEndpoint": {
                                    "browseId": "VLRDCLAK5uy_em",
                                    "browseEndpointContextSupportedConfigs": {
                                      "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_PLAYLIST" }
                                    }
                                  }
                                }
                              }
                            }
                          ]
                        }
                      },
                      {
                        "musicCarouselShelfRenderer": {
                          "header": { "musicCarouselShelfBasicHeaderRenderer": { "title": { "runs": [{ "text": "Fans might also like" }] } } },
                          "contents": [
                            {
                              "musicTwoRowItemRenderer": {
                                "title": { "runs": [{ "text": "50 Cent" }] },
                                "subtitle": { "runs": [{ "text": "108M monthly audience" }] },
                                "navigationEndpoint": {
                                  "browseEndpoint": {
                                    "browseId": "UCOcnYBwT1jb6EHlS0cwhNkA",
                                    "browseEndpointContextSupportedConfigs": {
                                      "browseEndpointContextMusicConfig": { "pageType": "MUSIC_PAGE_TYPE_ARTIST" }
                                    }
                                  }
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              }
            }]
          }
        }
      }
      """.trimIndent()
    )

    val profile = MusicBrowse.parseArtistProfile("UCedvOgsKFzcK3hA5taf3KoQ", json)
    assertEquals("Eminem", profile["name"])
    assertEquals("244M monthly audience", profile["subtitle"])

    val topSongs = profile["topSongs"] as List<Map<*, *>>
    assertEquals(1, topSongs.size)
    assertEquals(true, topSongs[0]["explicit"])

    val albums = profile["albums"] as List<Map<*, *>>
    assertEquals(1, albums.size)
    assertEquals("The Eminem Show", albums[0]["title"])
    assertEquals(true, albums[0]["explicit"])
    assertEquals("Eminem", albums[0]["artist"])

    val playlists = profile["playlists"] as List<Map<*, *>>
    assertEquals(1, playlists.size)
    assertEquals("VLRDCLAK5uy_em", playlists[0]["browseId"])

    val related = profile["relatedArtists"] as List<Map<*, *>>
    assertEquals(1, related.size)
    assertEquals("50 Cent", related[0]["name"])
  }

  @Test
  fun `parseCollectionDetail fails closed on unbadged OMV tracks in playlists while preserving album tracks`() {
    val albumJson = JsonParser.`object`().from(
      """
      {
        "contents": {
          "twoColumnBrowseResultsRenderer": {
            "tabs": [{
              "tabRenderer": {
                "content": {
                  "sectionListRenderer": {
                    "contents": [{
                      "musicResponsiveHeaderRenderer": {
                        "title": { "runs": [{ "text": "Por Tu Maldito Amor" }] },
                        "subtitle": { "runs": [{ "text": "Album • 1990" }] },
                        "straplineTextOne": { "runs": [{ "text": "Vicente Fernández" }] },
                        "thumbnail": { "musicThumbnailRenderer": { "thumbnail": { "thumbnails": [{ "url": "https://img/alb.jpg", "width": 544 }] } } }
                      }
                    }]
                  }
                }
              }
            }],
            "secondaryContents": {
              "sectionListRenderer": {
                "contents": [{
                  "musicShelfRenderer": {
                    "contents": [
                      {
                        "musicResponsiveListItemRenderer": {
                          "playlistItemData": { "videoId": "gfm2zSgQ8cQ" },
                          "flexColumns": [
                            { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Por Tu Maldito Amor" }] } } }
                          ],
                          "fixedColumns": [
                            { "musicResponsiveListItemFixedColumnRenderer": { "text": { "runs": [{ "text": "3:58" }] } } }
                          ]
                        }
                      }
                    ]
                  }
                }]
              }
            }
          }
        }
      }
      """.trimIndent()
    )

    val album = MusicBrowse.parseCollectionDetail("MPREb_ckLfEPIIv5v", albumJson)
    assertEquals("album", album["kind"])
    assertEquals("Vicente Fernández", album["artist"])
    val albumTracks = album["tracks"] as List<Map<*, *>>
    assertEquals(1, albumTracks.size)
    assertEquals("Vicente Fernández", albumTracks[0]["artist"])
    assertEquals("Por Tu Maldito Amor", albumTracks[0]["album"])
    assertEquals("https://img/alb.jpg", albumTracks[0]["artworkUrl"])
    assertEquals(false, albumTracks[0]["explicit"])

    val playlistJson = JsonParser.`object`().from(
      """
      {
        "contents": {
          "twoColumnBrowseResultsRenderer": {
            "tabs": [{
              "tabRenderer": {
                "content": {
                  "sectionListRenderer": {
                    "contents": [{
                      "musicResponsiveHeaderRenderer": {
                        "title": { "runs": [{ "text": "Presenting Artist" }] },
                        "subtitle": { "runs": [{ "text": "Playlist • 2026" }] }
                      }
                    }]
                  }
                }
              }
            }],
            "secondaryContents": {
              "sectionListRenderer": {
                "contents": [{
                  "musicShelfRenderer": {
                    "contents": [
                      {
                        "musicResponsiveListItemRenderer": {
                          "playlistItemData": { "videoId": "trackATV001" },
                          "flexColumns": [
                            {
                              "musicResponsiveListItemFlexColumnRenderer": {
                                "text": {
                                  "runs": [{
                                    "text": "Clean Audio Song",
                                    "navigationEndpoint": {
                                      "watchEndpoint": {
                                        "videoId": "trackATV001",
                                        "watchEndpointMusicSupportedConfigs": {
                                          "watchEndpointMusicConfig": { "musicVideoType": "MUSIC_VIDEO_TYPE_ATV" }
                                        }
                                      }
                                    }
                                  }]
                                }
                              }
                            },
                            { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Artist" }] } } }
                          ]
                        }
                      },
                      {
                        "musicResponsiveListItemRenderer": {
                          "playlistItemData": { "videoId": "trackOMV002" },
                          "flexColumns": [
                            {
                              "musicResponsiveListItemFlexColumnRenderer": {
                                "text": {
                                  "runs": [{
                                    "text": "Unbadged Video Row",
                                    "navigationEndpoint": {
                                      "watchEndpoint": {
                                        "videoId": "trackOMV002",
                                        "watchEndpointMusicSupportedConfigs": {
                                          "watchEndpointMusicConfig": { "musicVideoType": "MUSIC_VIDEO_TYPE_OMV" }
                                        }
                                      }
                                    }
                                  }]
                                }
                              }
                            },
                            { "musicResponsiveListItemFlexColumnRenderer": { "text": { "runs": [{ "text": "Artist" }] } } }
                          ]
                        }
                      }
                    ]
                  }
                }]
              }
            }
          }
        }
      }
      """.trimIndent()
    )

    val playlist = MusicBrowse.parseCollectionDetail("VLRDCLAK5uy_test", playlistJson)
    assertEquals("playlist", playlist["kind"])
    val plTracks = playlist["tracks"] as List<Map<*, *>>
    assertEquals(2, plTracks.size)
    assertEquals(false, plTracks[0]["explicit"])
    assertNull("OMV playlist rows without explicit badge stay unknown (fail closed)", plTracks[1]["explicit"])
  }

  @Test
  fun `browse error reasons never leak query or payload details`() {
    val reason = MusicBrowse.reasonFor(IOException("https://www.youtube.com/browse?secret=token"))
    assertEquals("innertube_browse_failed_ioexception", reason)
    assertTrue(!reason.contains("http") && !reason.contains("secret"))
  }
}
