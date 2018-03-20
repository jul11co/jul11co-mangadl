var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'NetTruyen',
  website: 'http://nettruyen.com',
  
  match: function(link, options) {
    return /nettruyen\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'NetTruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.list-chapter').length > 0) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'NetTruyen');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('h1.title-detail').text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '.list-chapter', { 
        filters: ['/truyen-tranh/'] 
      });
      if (options.verbose) console.log(page.chapter_links);

      page.chapter_links.reverse();

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else if ($('.page-chapter').length > 0) {
      var chapter_title = utils.replaceAll(page.title.trim(), ' - NetTruyen', '').trim();

      var chapter_images = saver.getImages($, page, '.page-chapter');
      if (options.verbose) console.log(chapter_images);

      page.output_dir = path.join(options.output_dir, path.basename(path.dirname(page.url)));

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}