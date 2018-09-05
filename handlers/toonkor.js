var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

var lastChar = function(str) {
  if (!str) return '';
  if (str.length == 1) return str;
  return str.substring(str.length-1);
}

var removeLastChar = function(str) {
  return str.substring(0, str.length-1);
}

var removeLastChars = function(str, char_to_remove) {
  while (lastChar(str) == char_to_remove) {
    str = removeLastChar(str);
  }
  return str;
}

var fromBase64 = function(str) {
  if (!str) return '';
  return Buffer.from(str, 'base64').toString('ascii');
}

module.exports = {
  
  name: 'ToonKor',
  website: 'https://toonkor.run',

  match: function(link, options) {
    return /toonkor\.app/g.test(link) || /toonkor\.run/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'ToonKor');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.view-wrap').length && $('.view-wrap .contents').length) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page:', page.url);

      var chapter_title = $('.view-wrap h1').first().text().trim();
      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      // chapter_title = utils.replaceAll(chapter_title, '.', '_');
      chapter_title = removeLastChars(chapter_title, '.');
      if (options.debug) console.log('Chapter title:', chapter_title);

      // Get images on current page
      var chapter_images = [];
      var chapter_script = '';
      $('script').each(function() {
        chapter_script += $(this).html();
      });

      var toon_img = utils.extractSubstring(chapter_script, 'var toon_img = \'', '\';')
      if (!toon_img || toon_img == '') {
        if (options.debug) console.log('No toon images');
        return callback();
      }
      
      $(".contents #toon_img").html(fromBase64(toon_img));

      $('.contents #toon_img img').each(function() {
        var image_src = $(this).attr('src');
        if (image_src) {
          if (image_src.indexOf('/') == 0 && image_src.indexOf('//') !== 0) {
            // image_src = 'https://toonkor.app' + image_src;
            if (page.url.indexOf('toonkor.app') != -1) {
              image_src = 'https://toonkor.app' + image_src;
            } else if (page.url.indexOf('toonkor.run') != -1) {
              image_src = 'https://toonkor.run' + image_src;
            }
          }
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      
      if (options.debug) console.log(chapter_images);
      if (chapter_images.length == 0) return callback();

      var chapter_output_dir = path.join(options.output_dir, chapter_title);
      
      options.request_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:59.0) Gecko/20100101 Firefox/59.0"
      };

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if ($('.bt_view1').length && $('#bo_list').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.bt_title').first().text();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      // manga_title = utils.replaceAll(manga_title, '.', '_');
      manga_title = removeLastChars(manga_title, '.');
      console.log('Manga title: ' + manga_title);
      // console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = this.getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }

      var chapter_links = [];
      $('#bo_list .web_list .content__title').each(function() {
        var chapter_url = $(this).attr('data-role');
        if (chapter_url) {
          if (chapter_url.indexOf('/') == 0) {
            // chapter_url = 'https://toonkor.app' + chapter_url;
            if (page.url.indexOf('toonkor.app') != -1) {
              chapter_url = 'https://toonkor.app' + chapter_url;
            } else if (page.url.indexOf('toonkor.run') != -1) {
              chapter_url = 'https://toonkor.run' + chapter_url;
            }
          }
          chapter_links.push(chapter_url);
        } 
      });

      chapter_links = chapter_links.map(function(chapter_link) {
        return encodeURI(decodeURI(chapter_link));
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        if (chapter_link.indexOf('toonkor.app') != -1) {
          return !saver.isDone(chapter_link.replace('toonkor.app', 'toonkor.run')); 
        } else if (chapter_link.indexOf('toonkor.run') != -1) {
          return !saver.isDone(chapter_link.replace('toonkor.run', 'toonkor.app')); 
        }
        return true;
      });

      // console.log(chapter_links);

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.bt_view1').length && $('#bo_list').length) {
      manga_info.url = page.url;
      manga_info.name = $('.bt_title').first().text().trim();
      manga_info.cover_image = $('.bt_thumb img').first().attr('src');
      if (manga_info.cover_image.indexOf('/') == 0) {
        // manga_info.cover_image = 'https://toonkor.app' + manga_info.cover_image;
        if (page.url.indexOf('toonkor.app') != -1) {
          manga_info.cover_image = 'https://toonkor.app' + manga_info.cover_image;
        } else if (page.url.indexOf('toonkor.run') != -1) {
          manga_info.cover_image = 'https://toonkor.run' + manga_info.cover_image;
        }
      }
      manga_info.description = $('.bt_over').first().text().trim();

      var manga_chapters = [];
      $('#bo_list .web_list .content__title').each(function() {
        var chapter_url = $(this).attr('data-role');
        if (chapter_url) {
          if (chapter_url.indexOf('/') == 0) {
            // chapter_url = 'https://toonkor.app' + chapter_url;
            if (page.url.indexOf('toonkor.app') != -1) {
              chapter_url = 'https://toonkor.app' + chapter_url;
            } else if (page.url.indexOf('toonkor.run') != -1) {
              chapter_url = 'https://toonkor.run' + chapter_url;
            }
          }
          manga_chapters.push({
            url: chapter_url,
            title: $(this).text().trim(),
            published_date_str: $(this).parent().children('td.episode_index').first().text().trim()
          });
        }
      });

      manga_info.chapter_count = manga_chapters.length;
          
      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }
      
      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        console.log('    Authors: ' + manga_info.authors);
        console.log('    Genres: ' + manga_info.genres);
        console.log('    Status: ' + manga_info.status);
        console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
