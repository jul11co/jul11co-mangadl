var path = require('path');
var urlutil = require('url');

var moment = require('moment');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaDex',
  website: 'https://mangadex.org',

  match: function(link, options) {
    return /mangadex\.com\/manga\//g.test(link) || /mangadex\.com\/chapter\//g.test(link)
      || /mangadex\.org\/manga\//g.test(link) || /mangadex\.org\/chapter\//g.test(link); 
    // MangaDex changes its domain from .com -> .org
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaDex');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('/chapter/') > 0/* &&  $('#current_page').length*/) {
      console.log('Chapter page: ' + page.url);

      var selected_chapter = $('#jump_chapter').first().val().trim();
      var chapter_title = $('#jump_chapter option[value="' + selected_chapter + '"]').text().trim();

      var selected_group = $('#jump_group').first().val().trim();
      var group_name = $('#jump_group option[value="' + selected_group + '"]').text().trim();
      if (group_name) {
        // console.log('Group: ' + group_name);
        chapter_title = chapter_title.trim() + ' [' + group_name.trim() + ']';
      }

      var selected_option_content = $('#jump_group option[value="' + selected_group + '"]').data('content');
      var language_name = utils.extractSubstring(selected_option_content||'', 'alt=\'', '\' title=\'');
      if (language_name) {
        // console.log('Language: ' + language_name);
        chapter_title = chapter_title.trim() + ' (' + language_name.trim() + ')';
      }

      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      console.log('Chapter title:', chapter_title);

      var chapter_script = $.html('script');
      if (!chapter_script) {
        console.log('No chapter script available');
        return callback();
      }

      var data_url = utils.extractSubstring(chapter_script, 'var dataurl =', ';');
      var pages_array = utils.extractSubstring(chapter_script, 'var page_array = [', '];');
      var image_server = utils.extractSubstring(chapter_script, 'var server =', ';');

      if (!data_url || !pages_array || !image_server) return callback();

      data_url = utils.replaceAll(data_url, '\'', '').trim();
      image_server = utils.replaceAll(image_server, '\'', '').trim();
      if (image_server.indexOf('/') == 0) {
        // image_server = 'https://mangadex.com' + image_server;
        // MangaDex changes its domain from .com -> .org
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

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir));
      }
      
      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if (page.url.indexOf('/manga/') > 0 && $('#content').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('#content h3.panel-title').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
      console.log('Manga title: ' + manga_title);
      // console.log('Chapter list');

      var current_url = saver.getStateData('url') || '';

      if (!current_url || (page.url.indexOf(current_url) != 0)) {
        if (options.auto_manga_dir) {
          options.output_dir = path.join(options.output_dir, manga_title);
          saver.setMangaOutputDir(options.output_dir);
        }
        saver.setStateData('url', page.url);
      }

      if (!options.manga_page_url || page.url.indexOf(options.manga_page_url) == -1) {
        options.manga_page_url = page.url;

        if (options.save_index_html) {
          saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
        }
        var manga_info = getMangaInfo($, page, options);
        if (manga_info && manga_info.url) {
          saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
        }
      }

      // var chapter_links = saver.getLinks($, page, '#chapters', {
      //   filters: ['/chapter/']
      // });

      var manga_chapters = [];
      $('#chapters table tr').each(function() {
        var chapter_url = $(this).find('td').eq(1).find('a').attr('href');
        if (!chapter_url) return;
        manga_chapters.push({
          url: chapter_url,
          language: $(this).find('td').eq(2).find('img').attr('title'),
          group: $(this).find('td').eq(3).find('a').text().trim(),
          submitter: $(this).find('td').eq(4).find('a').text().trim()
        });
      });

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
          console.log('Hint: filter MangaDex chapters by language (--mangadex_language=<LANGUAGE>).' + 
            ' LANGUAGE=English,Spanish,Russian,German,...');
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
        var submitter = saver.getStateData('mangadex_group');
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

      var chapter_links = manga_chapters.map(function(chapter) {
        return chapter.url;
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('mangadex.org', 'mangadex.com')); 
        // MangaDex changes its domain from .com -> .org
      });

      options.paging_links = options.paging_links || {};
      options.paging_links[page.url] = 1;

      var paging_links = [];
      if ($('#chapters ul.pagination').length && $('#chapters ul.pagination li a').length) {
        $('#chapters ul.pagination li a').each(function() {
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
  }
}

var getMangaInfo = function($, page, options) {
  var manga_info = {};
  if (page.url.indexOf('/manga/') > 0 && $('#content').length) {
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
    if ($('#chapters table tr').length) {
      $('#chapters table tr').each(function() {
        var $chapter = $(this).find('td').eq(1).find('a').first();
        var chapter_info = {
          url: $chapter.attr('href'),
          title: $chapter.text().trim(),
          chapter_id: $chapter.attr('data-chapter-id'),
          chapter_name: $chapter.attr('data-chapter-name'),
          chapter_num: $chapter.attr('data-chapter-num'),
          volume_num: $chapter.attr('data-volume-num'),
        };
        if (!chapter_info.url || !chapter_info.title) return;
        // language
        chapter_info.language = $(this).find('td').eq(2).find('img').attr('title');
        // group
        var $chapter_group = $(this).find('td').eq(3).find('a');
        chapter_info.group = {
          name: $chapter_group.text().trim(),
          url: $chapter_group.attr('href')
        };
        // submitter
        var $chapter_submitter = $(this).find('td').eq(4).find('a');
        chapter_info.submitter = {
          name: $chapter_submitter.text().trim(),
          url: $chapter_submitter.attr('href')
        };
        // added date
        var added_date_str = $(this).find('td').eq(6).find('time').attr('datetime');
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