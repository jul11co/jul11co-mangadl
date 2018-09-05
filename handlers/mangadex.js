var path = require('path');
var urlutil = require('url');

var moment = require('moment');

var utils = require('jul11co-wdt').Utils;
var downloader = require('jul11co-wdt').Downloader;

module.exports = {
  
  name: 'MangaDex',
  website: 'https://mangadex.org',

  match: function(link, options) {
    return /mangadex\.org\/manga\//g.test(link) || /mangadex\.org\/chapter\//g.test(link)
      || /mangadex\.org\/title\//g.test(link); 
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaDex');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    var filterChapters = function(manga_chapters) {

      var filter_language = options.mangadex_language || saver.getStateData('mangadex_language');
      var filter_group = options.mangadex_group || saver.getStateData('mangadex_group');
      var filter_submitter = options.mangadex_submitter || saver.getStateData('mangadex_submitter');

      if (filter_language) {
        var language = saver.getStateData('mangadex_language');
        if (!language || language != filter_language) {
          saver.updateStateData('mangadex_language', filter_language);
        }
        console.log('Language: ' + filter_language);
        if (filter_language != 'All') {
          manga_chapters = manga_chapters.filter(function(chapter) {
            return chapter.language.indexOf(filter_language) != -1;
          });
        }
      } else {
        if (!options.hint_displayed) {
          options.hint_displayed = true;
          console.log('Hint: filter MangaDex chapters by language: --mangadex-language=<LANGUAGE>' + 
            ' with LANGUAGE=English,Spanish,Russian,German,...');
        }
      }
      if (filter_group) {
        var group = saver.getStateData('mangadex_group');
        if (!group || group != filter_group) {
          saver.updateStateData('mangadex_group', filter_group);
        }
        console.log('Group: ' + filter_group);
        if (filter_group != 'All') {
          manga_chapters = manga_chapters.filter(function(chapter) {
            return chapter.group.indexOf(filter_group) != -1;
          });
        }
      }
      if (filter_submitter) {
        var submitter = saver.getStateData('mangadex_submitter');
        if (!submitter || submitter != filter_submitter) {
          saver.updateStateData('mangadex_submitter', filter_submitter);
        }
        console.log('Submitter: ' + filter_submitter);
        if (filter_submitter != 'All') {
          manga_chapters = manga_chapters.filter(function(chapter) {
            return chapter.submitter.indexOf(filter_submitter) != -1;
          });
        }
      }

      return manga_chapters;
    }

    if (page.url.indexOf('/chapter/') > 0) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page: ' + page.url);

      if ($('.reader-controls').length) {
        var chapter_id = page.url.replace('https://mangadex.org/chapter/','').split('/')[0];
        var chapter_url = 'https://mangadex.org/chapter/' + chapter_id;

        downloader.downloadJson('https://mangadex.org/api/chapter/' + chapter_id, function(err, json) {
          if (err) return callback(err);
          if (!json) return callback(new Error('Cannot get MangaDex chapter info'));

          var chapter_title = '';
          if (json['volume']) chapter_title += 'Volume ' + json['volume'] + ' ';
          if (json['chapter']) chapter_title += 'Chapter ' + json['chapter'] + ' ';
          if (json['title'] && !options.mangadex_no_chapter_title) {
            chapter_title += '- ' + json['title'].trim();
          }
          if (options.mangadex_chapters_map && options.mangadex_chapters_map[chapter_url]) {
            if (options.mangadex_chapters_map[chapter_url]['group']) {
              chapter_title += ' [' + options.mangadex_chapters_map[chapter_url]['group'] + ']';
            }
          }
          if (json['lang_name']) chapter_title += ' (' + json['lang_name'] + ')';

          // var group_id = json['group_id'];
          // var group_id_2 = json['group_id_2'];
          // var group_id_3 = json['group_id_3'];

          chapter_title = chapter_title.trim();
          chapter_title = utils.replaceAll(chapter_title, '  ', ' ');

          var image_server = json['server'];
          if (image_server.indexOf('mangadex.org') == -1) {
            image_server = 'https://mangadex.org' + image_server;
          }
          var chapter_hash = json['hash'];
          var pages = json['page_array'];

          var chapter_images = [];
          pages.forEach(function(page_image) {
            chapter_images.push({
              src: image_server + chapter_hash + '/' + page_image
            })
          });

          if (chapter_images.length == 0) return callback();
          if (options.debug) console.log(chapter_images);

          var chapter_output_dir = utils.replaceAll(chapter_title, '/', '-');
          chapter_output_dir = utils.replaceAll(chapter_output_dir, ':', ' -');

          saver.downloadMangaChapter({
            chapter_url: page.url,
            chapter_title: chapter_title,
            chapter_images: chapter_images,
            output_dir: path.join(options.output_dir, chapter_output_dir)
          }, options, callback);

        });
      } else if ($('#jump_chapter').length) {

        var selected_chapter = $('#jump_chapter').first().val().trim();
        var chapter_title = $('#jump_chapter option[value="' + selected_chapter + '"]').text().trim();

        var selected_group = $('#jump_group').first().val().trim();
        var group_name = $('#jump_group option[value="' + selected_group + '"]').text().trim();
        if (group_name) {
          if (options.verbose) console.log('Group: ' + group_name);
          chapter_title = chapter_title.trim() + ' [' + group_name.trim() + ']';
        }

        var selected_option_content = $('#jump_group option[value="' + selected_group + '"]').data('content');
        var language_name = utils.extractSubstring(selected_option_content||'', 'alt=\'', '\' title=\'');
        if (language_name) {
          if (options.verbose) console.log('Language: ' + language_name);
          chapter_title = chapter_title.trim() + ' (' + language_name.trim() + ')';
        }

        chapter_title = utils.replaceAll(chapter_title, '  ', ' ');

        if (options.debug) console.log('Chapter title:', chapter_title);

        var chapter_script = $.html('script');
        if (!chapter_script) {
          if (options.debug) console.log('No chapter script available');
          return callback();
        }

        var data_url = utils.extractSubstring(chapter_script, 'var dataurl =', ';');
        var pages_array = utils.extractSubstring(chapter_script, 'var page_array = [', '];');
        var image_server = utils.extractSubstring(chapter_script, 'var server =', ';');

        if (!data_url || !pages_array || !image_server) return callback();

        data_url = utils.replaceAll(data_url, '\'', '').trim();
        image_server = utils.replaceAll(image_server, '\'', '').trim();
        if (image_server.indexOf('/') == 0) {
          image_server = 'https://mangadex.org' + image_server; 
        }
        pages_array = utils.replaceAll(pages_array, '\r\n', '').trim();
        var pages = pages_array.split(',');

        // console.log(image_server, data_url, pages_array);

        var chapter_images = [];
        pages.forEach(function(page_image) {
          if (page_image) {
            page_image = utils.replaceAll(page_image, '\'', '');
            if (page_image) {
              chapter_images.push({
                src: image_server + data_url + '/' + page_image
              })
            }
          }
        });

        if (chapter_images.length == 0) return callback();
        if (options.debug) console.log(chapter_images);

        var chapter_output_dir = utils.replaceAll(chapter_title, '/', '-');
        chapter_output_dir = utils.replaceAll(chapter_output_dir, ':', ' -');

        saver.downloadMangaChapter({
          chapter_url: page.url,
          chapter_title: chapter_title,
          chapter_images: chapter_images,
          output_dir: path.join(options.output_dir, chapter_output_dir)
        }, options, callback);
        
      } else {
        return callback();
      }
    } else if ((page.url.indexOf('/manga/') > 0 || page.url.indexOf('/title/') > 0) 
      && $('.card').length
      && $('.edit.tab-content .chapter-container').length) { // MangaDex V3
      console.log('----');
      console.log('Manga page: ' + page.url);

      $('.card h6.card-header span').remove();
      $('.card h6.card-header img').remove();
      $('.card h6.card-header span').remove();
      var manga_title = $('.card h6.card-header').first().text().trim();

      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      var current_url = saver.getStateData('url') || '';

      if (!current_url || (page.url.indexOf('/chapters/') == -1)) {
        if (options.auto_manga_dir) {
          options.output_dir = path.join(options.output_dir, manga_title);
          saver.setMangaOutputDir(options.output_dir);
        }
        saver.setStateData('url', page.url);
      }

      if (!options.mangadex_manga_url || 
        (page.url.indexOf(options.mangadex_manga_url) == -1 && page.url.indexOf('/chapters/') == -1)) {
        options.mangadex_manga_url = page.url;

        console.log('Manga URL:', options.mangadex_manga_url);

        if (options.save_index_html) {
          saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
        }
        var manga_info = this.getMangaInfo($, page, options);
        if (manga_info && manga_info.url) {
          saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
        }
      }

      if (options.update_info_only) {
        return callback();
      }

      var manga_chapters = [];
      $('.edit.tab-content .chapter-container .chapter-row').each(function() {
        var chapter = {};

        chapter.chapter_id = $(this).attr('data-id');
        chapter.chapter_title = $(this).attr('data-title');
        chapter.manga_id = $(this).attr('data-manga-id');
        chapter.volume_num = $(this).attr('data-volume');
        chapter.chapter_num = $(this).attr('data-chapter');
        chapter.lang_id = $(this).attr('data-lang');
        chapter.group_id = $(this).attr('data-group');
        chapter.uploader = $(this).attr('data-uploader');
        chapter.timestamp = $(this).attr('data-timestamp');

        if (chapter.timestamp) {
          chapter.timestamp = parseInt(chapter.timestamp);
          chapter.added = new Date(chapter.timestamp*1000);
        }

        // chapter.url = 'https://mangadex.org/chapter/' + chapter.chapter_id;

        $(this).find('a').each(function() {
          var link_href = $(this).attr('href');
          if (!link_href) return;

          if (link_href.indexOf('/chapter/') != -1 && link_href.indexOf('/comments') == -1) {
            chapter.url = link_href;
            chapter.title = $(this).text().trim();
            chapter.title = utils.replaceAll(chapter.title, 'Vol. ' + chapter.volume_num, 'Volume ' + chapter.volume_num);
            chapter.title = utils.replaceAll(chapter.title, 'Ch. ' + chapter.chapter_num, 'Chapter ' + chapter.chapter_num);
            chapter.title = utils.replaceAll(chapter.title, '\r', '');
            chapter.title = utils.replaceAll(chapter.title, '\n', '');
            chapter.title = utils.replaceAll(chapter.title, '\t', '');
            if (options.debug) {
              console.log(chapter.url, '-', chapter.title);
            }
          } else if (link_href.indexOf('/group/') != -1) {
            chapter.group = $(this).text().trim();
          } else if (link_href.indexOf('/user/') != -1) {
            chapter.submitter = $(this).text().trim();
          }
        });

        chapter.language = $(this).find('img').attr('title');

        if (!chapter.url) return;

        if (chapter.added) {
          var added_moment = moment.utc(chapter.added);
          if (added_moment.isValid() && moment().diff(added_moment) < 0) {
            // ignore delayed releases
            return;
          }
        }

        manga_chapters.push(chapter);
      });

      manga_chapters = filterChapters(manga_chapters);

      manga_chapters.forEach(function(chapter) {
        var downloaded_chapter = saver.getStateData(chapter.url);
        if (downloaded_chapter && chapter.title) {
          var chapter_title = chapter.title.trim();
          if (chapter.group) chapter_title += ' [' + chapter.group + ']';
          if (chapter.language) chapter_title += ' (' + chapter.language + ')';
          
          if (downloaded_chapter.chapter_title != chapter_title) {
            saver.updateStateData(chapter.url, {
              chapter_title: chapter_title
            });
          }
        }
      });

      var chapter_links = manga_chapters.map(function(chapter) {
        return chapter.url;
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        // MangaDex changes its domain from .com -> .org
        return !saver.isDone(chapter_link.replace('mangadex.org', 'mangadex.com')); 
      });

      options.paging_links = options.paging_links || {};
      options.paging_links[page.url] = 1;
      if (page.url.indexOf('/chapters/') == -1) {
        options.paging_links[page.url+'/chapters/1/'] = 1;
      }

      var paging_links = [];
      if ($('.edit.tab-content ul.pagination').length && $('.edit.tab-content ul.pagination li a').length) {
        $('.edit.tab-content ul.pagination li a').each(function() {
          var pagination_link = $(this).attr('href');
          if (pagination_link && paging_links.indexOf(pagination_link) == -1) {
            paging_links.push(pagination_link);
          }
        });
      }

      saver.downloadMangaChapters(chapter_links, options, function(err) {
        if (err) return callback(err);

        if (paging_links.length) {
          paging_links = paging_links.filter(function(paging_link) {
            return !options.paging_links[paging_link];
          });
          paging_links.forEach(function(paging_link) {
            saver.updateStateData(paging_link, {visited: 0});
          });

          saver.processPages(paging_links, options, callback);
        } else {
          callback();
        }
      });
    } else if ((page.url.indexOf('/manga/') > 0 || page.url.indexOf('/title/') > 0) 
      && $('#content').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#content h3.panel-title').first().text().trim();
      
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      var current_url = saver.getStateData('url') || '';

      if (!current_url || (page.url.indexOf(current_url) != 0)) {
        if (options.auto_manga_dir) {
          options.output_dir = path.join(options.output_dir, manga_title);
          saver.setMangaOutputDir(options.output_dir);
        }
        saver.setStateData('url', page.url);
      }

      if (!options.mangadex_manga_url || 
        (page.url.indexOf(options.mangadex_manga_url) == -1 && page.url.indexOf('/chapters/') == -1)) {
        options.mangadex_manga_url = page.url;

        console.log('Manga URL:', options.mangadex_manga_url);

        if (options.save_index_html) {
          saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
        }
        var manga_info = this.getMangaInfo($, page, options);
        if (manga_info && manga_info.url) {
          saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
        }
      }

      if (options.update_info_only) {
        return callback();
      }

      // var chapter_links = saver.getLinks($, page, '#chapters', {
      //   filters: ['/chapter/']
      // });

      // saver.saveHtmlFile($, page, options);

      var manga_chapters = [];
      $('.edit.tab-content table tbody tr').each(function() {
        var chapter = {};

        $(this).find('a').each(function() {
          var link_href = $(this).attr('href');
          if (!link_href) return;

          if (link_href.indexOf('/chapter/') != -1 && link_href.indexOf('/comments') == -1) {
            chapter.url = link_href;
            chapter.title = $(this).text().trim();
            if (options.debug) {
              console.log(chapter.url, '-', chapter.title);
            }
          } else if (link_href.indexOf('/group/') != -1) {
            chapter.group = $(this).text().trim();
          } else if (link_href.indexOf('/user/') != -1) {
            chapter.submitter = $(this).text().trim();
          }
        });

        if (!chapter.url) return;

        chapter.language = $(this).find('img').attr('title');

        var added_date_str = $(this).find('time').attr('datetime');
        if (added_date_str && added_date_str != '') {
          var added_moment = moment.utc(added_date_str, 'YYYY-MM-DD hh:mm:ss');
          if (added_moment.isValid() && moment().diff(added_moment) < 0) {
            // ignore delayed releases
            return;
          }
        }

        manga_chapters.push(chapter);
      });

      manga_chapters = filterChapters(manga_chapters);

      var chapter_links = manga_chapters.map(function(chapter) {
        return chapter.url;
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        // MangaDex changes its domain from .com -> .org
        return !saver.isDone(chapter_link.replace('mangadex.org', 'mangadex.com')); 
      });

      options.paging_links = options.paging_links || {};
      options.paging_links[page.url] = 1;

      var paging_links = [];
      if ($('.edit.tab-content ul.pagination').length && $('.edit.tab-content ul.pagination li a').length) {
        $('.edit.tab-content ul.pagination li a').each(function() {
          var pagination_link = $(this).attr('href');
          if (pagination_link && paging_links.indexOf(pagination_link) == -1) {
            paging_links.push(pagination_link);
          }
        });
      }

      saver.downloadMangaChapters(chapter_links, options, function(err) {
        if (err) return callback(err);

        if (paging_links.length) {
          paging_links = paging_links.filter(function(paging_link) {
            return !options.paging_links[paging_link];
          });
          paging_links.forEach(function(paging_link) {
            saver.updateStateData(paging_link, {visited: 0});
          });

          saver.processPages(paging_links, options, callback);
        } else {
          callback();
        }
      });
    
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ((page.url.indexOf('/manga/') > 0 || page.url.indexOf('/title/') > 0) && $('.card').length) { // V3
      manga_info.url = page.url;

      $('.card h6.card-header span').remove();
      $('.card h6.card-header img').remove();
      $('.card h6.card-header span').remove();
      manga_info.name = $('.card h6.card-header').first().text().trim();

      manga_info.cover_image = $('.card .edit img').first().attr('src');
      if (manga_info.cover_image && manga_info.cover_image.indexOf('/') == 0) {
        manga_info.cover_image = 'https://mangadex.org' + manga_info.cover_image;
      }

      $('.card .edit .row').each(function() {
        var content_key = $(this).find('.strong').first().text().trim();

        if (content_key == 'Alt name(s):') {
          manga_info.alt_names = [];
          $(this).find('ul li').each(function() {
            var alt_name = $(this).text().trim();
            if (alt_name && manga_info.alt_names.indexOf(alt_name) == -1) {
              manga_info.alt_names.push(alt_name);
            }
          });
        } else if (content_key == 'Author:') {
          manga_info.authors = [];
          $(this).find('a').each(function() {
            var author_name = $(this).text().trim();
            if (author_name && manga_info.authors.indexOf(author_name) == -1) {
              manga_info.authors.push(author_name);
            }
          });
        } else if (content_key == 'Artist:') {
          manga_info.artists = [];
          $(this).find('a').each(function() {
            var artist_name = $(this).text().trim();
            if (artist_name && manga_info.artists.indexOf(artist_name) == -1) {
              manga_info.artists.push(artist_name);
            }
          });
        } else if (content_key == 'Genres:') {
          manga_info.genres = [];
          $(this).find('a.genre').each(function() {
            var genre_name = $(this).text().trim();
            if (genre_name) {
              var genre_url = $(this).attr('href');
              if (genre_url && genre_url.indexOf('/') == 0) {
                genre_url = 'https://mangadex.org' + genre_url;
              }
              manga_info.genres.push({
                name: genre_name,
                url: genre_url
              });
            }
          });
        } else if (content_key == 'Status:') {
          manga_info.status = $(this).children('div').eq(1).text().trim();
        } else if (content_key == 'Pub. status:') {
          manga_info.status = $(this).children('div').eq(1).text().trim();
        } else if (content_key == 'Description:') {
          manga_info.description = $(this).children('div').eq(1).text().trim();
          manga_info.description_html = $(this).children('div').eq(1).html();
        } else if (content_key == 'Links:') {
          manga_info.links = [];
          $(this).find('a').each(function() {
            var link_url = $(this).attr('href');
            if (!link_url) return;
            manga_info.links.push({
              name: $(this).text().trim(),
              url: link_url
            });
            if (link_url.indexOf('myanimelist.net') != -1) {
              manga_info.mal_url = link_url;
            } else if (link_url.indexOf('mangaupdates.com') != -1) {
              manga_info.mu_url = link_url;
            }
          });
        } else if (content_key == 'Related:') {
          manga_info.related = [];
          $(this).find('a').each(function() {
            var related_manga_name = $(this).text().trim();
            if (related_manga_name) {
              var related_manga_url = $(this).attr('href');
              if (related_manga_url && related_manga_url.indexOf('/') == 0) {
                related_manga_url = 'https://mangadex.org' + related_manga_url;
              }
              manga_info.related.push({
                name: related_manga_name,
                url: related_manga_url,
                type: $(this).parent().children('span.small').text().trim()
              });
            }
          });
        } 
      });

      var manga_chapters = [];
      $('.edit.tab-content .chapter-container .chapter-row').each(function() {
        var chapter_info = {};

        chapter_info.chapter_id = $(this).attr('data-id');
        chapter_info.chapter_title = $(this).attr('data-title');
        chapter_info.manga_id = $(this).attr('data-manga-id');
        chapter_info.volume_num = $(this).attr('data-volume');
        chapter_info.chapter_num = $(this).attr('data-chapter');
        chapter_info.lang_id = $(this).attr('data-lang');
        chapter_info.group_id = $(this).attr('data-group');
        chapter_info.uploader = $(this).attr('data-uploader');
        chapter_info.timestamp = $(this).attr('data-timestamp');

        if (chapter_info.timestamp) {
          chapter_info.timestamp = parseInt(chapter_info.timestamp);
          chapter_info.added = new Date(chapter_info.timestamp*1000);
        }

        // chapter_info.url = 'https://mangadex.org/chapter/' + chapter_info.chapter_id;

        $(this).find('a').each(function() {
          var link_href = $(this).attr('href');
          if (!link_href) return;

          if (link_href.indexOf('/chapter/') != -1 && link_href.indexOf('/comments') == -1) {
            chapter_info.url = link_href;
            chapter_info.title = $(this).text().trim();
            chapter_info.title = utils.replaceAll(chapter_info.title, '\r', '');
            chapter_info.title = utils.replaceAll(chapter_info.title, '\n', '');
            chapter_info.title = utils.replaceAll(chapter_info.title, '\t', '');
            if (options.debug) {
              console.log(chapter_info.url, '-', chapter_info.title);
            }
          } else if (link_href.indexOf('/group/') != -1) {
            chapter_info.group = $(this).text().trim();
          } else if (link_href.indexOf('/user/') != -1) {
            chapter_info.submitter = $(this).text().trim();
          }
        });

        chapter_info.language = $(this).find('img').attr('title');

        if (!chapter_info.url) return;

        if (chapter_info.added) {
          var added_moment = moment.utc(chapter_info.added);
          if (added_moment.isValid() && moment().diff(added_moment) < 0) {
            // ignore delayed releases
            return;
          }
        }

        if (!options.mangadex_chapters_map) {
          options.mangadex_chapters_map = {};
        }

        options.mangadex_chapters_map[chapter_info.url] = chapter_info;

        manga_chapters.push(chapter_info);
      });

      manga_info.chapter_count = manga_chapters.length;

      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }
      
      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name:', manga_info.name);
        console.log('    Cover image:', manga_info.cover_image);
        // console.log('    Description:', manga_info.description);
        console.log('    Authors:', manga_info.authors);
        console.log('    Genres:', manga_info.genres);
        console.log('    Status:', manga_info.status);
        console.log('    Chapter count:', manga_info.chapter_count);
      }
    }
    else if ((page.url.indexOf('/manga/') > 0 || page.url.indexOf('/title/') > 0) && $('#content').length) {
      manga_info.url = page.url;
      manga_info.name = $('#content h3.panel-title').first().text().trim();
      manga_info.cover_image = $('#content .edit img').first().attr('src');
      if (manga_info.cover_image && manga_info.cover_image.indexOf('/') == 0) {
        manga_info.cover_image = 'https://mangadex.org' + manga_info.cover_image;
      }

      $('#content .edit table').first().find('tr').each(function() {
        var content_key = $(this).find('th').text().trim();
        if (content_key == 'Alt name(s):') {
          manga_info.alt_names = [];
          $(this).find('ul li').each(function() {
            var alt_name = $(this).text().trim();
            if (alt_name && manga_info.alt_names.indexOf(alt_name) == -1) {
              manga_info.alt_names.push(alt_name);
            }
          });
        } else if (content_key == 'Author:') {
          manga_info.authors = [];
          $(this).find('a').each(function() {
            var author_name = $(this).text().trim();
            if (author_name && manga_info.authors.indexOf(author_name) == -1) {
              manga_info.authors.push(author_name);
            }
          });
        } else if (content_key == 'Artist:') {
          manga_info.artists = [];
          $(this).find('a').each(function() {
            var artist_name = $(this).text().trim();
            if (artist_name && manga_info.artists.indexOf(artist_name) == -1) {
              manga_info.artists.push(artist_name);
            }
          });
        } else if (content_key == 'Genres:') {
          manga_info.genres = [];
          $(this).find('a.genre').each(function() {
            var genre_name = $(this).text().trim();
            if (genre_name) {
              // manga_info.genres.push(genre_name);
              var genre_url = $(this).attr('href');
              if (genre_url && genre_url.indexOf('/') == 0) {
                genre_url = 'https://mangadex.org' + genre_url;
              }
              manga_info.genres.push({
                name: genre_name,
                url: genre_url
              });
            }
          });
        } else if (content_key == 'Status:') {
          manga_info.status = $(this).find('td').first().text().trim();
        } else if (content_key == 'Pub. status:') {
          manga_info.status = $(this).find('td').first().text().trim();
        } else if (content_key == 'Description:') {
          manga_info.description = $(this).find('td').first().text().trim();
          manga_info.description_html = $(this).find('td').first().html();
        } else if (content_key == 'Links:') {
          manga_info.links = [];
          $(this).find('a').each(function() {
            var link_url = $(this).attr('href');
            if (!link_url) return;
            manga_info.links.push({
              name: $(this).text().trim(),
              url: link_url
            });
            if (link_url.indexOf('myanimelist.net') != -1) {
              manga_info.mal_url = link_url;
            } else if (link_url.indexOf('mangaupdates.com') != -1) {
              manga_info.mu_url = link_url;
            }
          });
        } else if (content_key == 'Related:') {
          manga_info.related = [];
          $(this).find('a').each(function() {
            var related_manga_name = $(this).text().trim();
            if (related_manga_name) {
              var related_manga_url = $(this).attr('href');
              if (related_manga_url && related_manga_url.indexOf('/') == 0) {
                related_manga_url = 'https://mangadex.org' + related_manga_url;
              }
              manga_info.related.push({
                name: related_manga_name,
                url: related_manga_url,
                type: $(this).parent().children('span.small').text().trim()
              });
            }
          });
        } 
      });

      var manga_chapters = [];
      if ($('.edit.tab-content table tbody tr').length) {
        $('.edit.tab-content table tbody tr').each(function() {
          var chapter_info = {};

          $(this).find('a').each(function() {
            var link_href = $(this).attr('href');
            if (!link_href) return;
            if (link_href.indexOf('/chapter/') != -1) {
              chapter_info.url = link_href;
              chapter_info.title = $(this).text().trim();
              chapter_info.chapter_id = $(this).attr('data-chapter-id');
              chapter_info.chapter_name = $(this).attr('data-chapter-name');
              chapter_info.chapter_num = $(this).attr('data-chapter-num');
              chapter_info.volume_num = $(this).attr('data-volume-num');
            } else if (link_href.indexOf('/group/') != -1) {
              chapter_info.group = {
                name: $(this).text().trim(),
                url: link_href
              };
            } else if (link_href.indexOf('/user/') != -1) {
              chapter_info.submitter = {
                name: $(this).text().trim(),
                url: link_href
              };
            }
          });

          if (!chapter_info.url || !chapter_info.title) return;

          chapter_info.language = $(this).find('img').attr('title');

          // added date
          var added_date_str = $(this).find('time').attr('datetime');
          if (added_date_str && added_date_str != '') {
            var added_moment = moment.utc(added_date_str, 'YYYY-MM-DD hh:mm:ss');
            if (added_moment.isValid()) {
              chapter_info.added = added_moment.toDate();
            }
          }

          manga_chapters.push(chapter_info);
        });
      }

      manga_info.chapter_count = manga_chapters.length;

      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }
      
      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name:', manga_info.name);
        console.log('    Cover image:', manga_info.cover_image);
        // console.log('    Description:', manga_info.description);
        console.log('    Authors:', manga_info.authors);
        console.log('    Genres:', manga_info.genres);
        console.log('    Status:', manga_info.status);
        console.log('    Chapter count:', manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
