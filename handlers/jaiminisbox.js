var path = require('path');
var urlutil = require('url');

var moment = require('moment');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Jaimini\'sBox',
  website: 'https://jaiminisbox.com/reader/',

  match: function(link, options) {
    return /jaiminisbox\.com\/reader\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'JaiminisBox');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('/reader/read/') > 0 &&  $('#page').length) {
      if (options.debug) console.log('---');
      if (options.debug) console.log('Chapter page: ' + page.url);

      var chapter_title = $('.topbar_left h1.tbtitle a').last().text().trim();
      var chapter_url = $('.topbar_left h1.tbtitle a').last().attr('href');

      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      if (options.debug) console.log('Chapter title:', chapter_title);

      var chapter_script = $.html('script');
      if (!chapter_script) {
        if (options.debug) console.log('No chapter script available');
        return callback();
      }

      var pages_array_b64_str = utils.extractSubstring(chapter_script, 'JSON.parse(atob("', '"));');
      var cdn_server = utils.extractSubstring(chapter_script, 'var cdn = "', '";');

      if (!pages_array_b64_str || !cdn_server) return callback();

      var pages = [];
      try {
        var pages_array_str = Buffer.from(pages_array_b64_str, 'base64').toString();
        pages = JSON.parse(pages_array_str);
        // console.log(cdn_server, pages_array_str, pages);
      } catch(e) {
        console.log(e);
      }

      var chapter_images = [];
      pages.forEach(function(page_image) {
        if (!page_image || !page_image.url) return;
        chapter_images.push({
          src: page_image.url,
          file: page_image.filename,
          size: parseInt(page_image.size),
          width: parseInt(page_image.width),
          height: parseInt(page_image.height)
        });
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
        chapter_url: chapter_url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if (page.url.indexOf('/reader/series/') > 0 && $('.comic.info').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.comic h1.title').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
      console.log('Manga title: ' + manga_title);
      // console.log('Chapter list');

      var current_url = saver.getStateData('url') || '';

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

      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, '.list', {
        filters: ['/reader/read/']
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if (page.url.indexOf('/reader/series') > 0 && $('.comic.info').length) {
      manga_info.url = page.url;
      manga_info.name = $('.comic h1.title').first().text().trim();
      manga_info.cover_image = $('.comic.info .thumbnail img').first().attr('src');

      var comic_info_html = $('.comic.info .comic div.info').html();
      // manga_info.description = comic_info_html; // FIXME: get authors, artists & synopsis

      if (comic_info_html) {
        comic_info_html.split('<br>').forEach(function(info_line) {
          if (!info_line) return;
          info_line = info_line.trim();
          var info_key = utils.extractSubstring(info_line, '<b>', '</b>:');
          
          if (info_key == 'Author') {
            var author_str = info_line.replace('<b>Author</b>:','').trim();
            manga_info.authors = author_str.split(', ');
          } else if (info_key == 'Artist') {
            var artist_str = info_line.replace('<b>Artist</b>:','').trim();
            manga_info.artists = artist_str.split(', ');
          } else if (info_key == 'Synopsis') {
            var description_str = info_line.replace('<b>Synopsis</b>:','').trim();
            manga_info.description = description_str;
          }
        });
      }

      var manga_chapters = [];
      if ($('.list .group .element').length) {
        $('.list .group .element').each(function() {
          var $chapter_link = $(this).find('div.title').find('a');
          var chapter_info = {
            url: $chapter_link.attr('href'),
            title: $chapter_link.text().trim(),
            published_date_str: $(this).find('div.meta_r').text().trim()
          };
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
