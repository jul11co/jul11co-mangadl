var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'LHScans',
  website: 'http://lhscans.com',

  match: function(link, options) {
    return /lhscans\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'LHScans');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.chapter-content').length) {

      var chapter_title = $('.chapter-content-top ol.breadcrumb li').last().text().trim();
      if (chapter_title) {
        chapter_title = chapter_title.replace('- ', '');
        chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      }

      // console.log('Chapter title:', chapter_title);

      var chapter_images = saver.getImages($, page, '.chapter-content');
      if (chapter_images.length == 0) return callback();

      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir, '.html'));
      }
      
      // console.log('Output dir: ', options.output_dir);
      // console.log('Page output_dir:', page.output_dir);
      // console.log('Chapter output_dir:', chapter_output_dir);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('#tab-chapper').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir) {
        var manga_title = $('.info-manga ol.breadcrumb li').last().text().trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, '#tab-chapper');

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);
      if (options.verbose) console.log(chapter_links);

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}