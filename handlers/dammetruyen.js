var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Dammetruyen',
  website: 'http://dammetruyen.com',

  match: function(link, options) {
    return /dammetruyen\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Dammetruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#book_chapters_top').length) {

      var chapter_url = page.url;
      var chapter_title = $('.post .entry .ttl').text().trim();

      var chapter_script = '';
      $('script').each(function() {
        chapter_script += $(this).html();
      });

      if (!chapter_script) {
        return callback();
      }

      var tmp = utils.extractSubstring(chapter_script, 'loadingBookChapters(', ');');
      if (tmp == null) {
        console.log('Book_id and chapter not found!');
        return callback();
      }
      tmp = utils.replaceAll(tmp,'\'','');
      var book_id_and_chapter = tmp.split(",");
      if (!book_id_and_chapter || book_id_and_chapter.length != 2) {
        console.log('Invalid book_id and chapter: ' + book_id_and_chapter);
        return callback();
      }
      var book_id = book_id_and_chapter[0].trim();
      var chapter = book_id_and_chapter[1].trim();

      // console.log('book: ' +  book_id + '; chapter: ' + chapter);

      var chapter_url_obj = urlutil.parse(chapter_url);
      var output_dir_name = path.basename(chapter_url_obj.pathname);
      output_dir_name = output_dir_name.replace('.html', '');

      options.current_chapter = {
        url: chapter_url,
        title: chapter_title,
        output_dir: path.join((options.output_dir || '.'), output_dir_name)
      };

      var chapter_images_page = 'http://dammetruyen.com/truyen/gen_html_chapter/' + book_id + '/' + chapter;

      // Process next page
      saver.processPage(chapter_images_page, options, function(err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    } else if (page.url.indexOf('http://dammetruyen.com/truyen/gen_html_chapter/') >= 0) {

      if (typeof options.current_chapter == 'undefined') {
        console.log('Invalid current chapter');
        return callback();
      }

      var chapter_images = saver.getImages($, page, '');
      if (options.verbose) console.log(chapter_images);

      chapter_images.forEach(function(image) {
        if (image.file && image.file.length > 30) {
          image.file = utils.trimText(path.basename(image.file), 30) + path.extname(image.file); 
        }
      });

      var chapter_url = options.current_chapter.url;
      var chapter_title = options.current_chapter.title;
      var chapter_output_dir = options.current_chapter.output_dir;

      // reset options.current_chapter
      delete options.current_chapter;

      saver.downloadMangaChapter({
        chapter_url: chapter_url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('#book_chapters').length) {
      console.log('Chapter list');
      
      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Dammetruyen');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('h1.ttl').first().text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      var page_script = '';
      $('script').each(function() {
        page_script += $(this).html();
      });

      if (!page_script) {
        return callback();
      }

      var tmp = utils.extractSubstring(page_script, 'loadingBookChapters(', ');');
      if (tmp == null) {
        console.log('Book_id not found!');
        return callback();
      }
      tmp = utils.replaceAll(tmp,'\'','');
      if (!tmp || tmp == '') {
        console.log('Invalid book_id (empty)');
        return callback();
      }
      var book_id = tmp;

      var chapter_list_page = 'http://dammetruyen.com/truyen/gen_list_chapters/' + book_id;

      // Process next page
      saver.processPage(chapter_list_page, options, function(err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    } else if (page.url.indexOf('http://dammetruyen.com/truyen/gen_list_chapters/') >= 0) {

      page.chapter_links = saver.getLinks($, page, 'ul.lst');
      if (options.verbose) console.log(page.chapter_links);

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}