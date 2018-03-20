var path = require('path');

module.exports = {
  
  name: 'MangaK',
  website: 'http://mangak.info',

  match: function(link, options) {
    return /mangak\./g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaK');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.vung_doc').length) {

      var chapter_title = $('.name_chapter').text();

      var chapter_images = saver.getImages($, page, '.vung_doc');
      if (options.verbose) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('.chapter-list').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'MangaK');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('h1.entry-title').text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }
      
      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '.chapter-list', {
        exclude_visited_links: true
      });
      console.log(page.chapter_links.length + ' chapters');
      if (options.verbose) console.log(page.chapter_links);

      var chapter_links = page.chapter_links.filter(function(link) {
        return !saver.isDone(link);
      });
      console.log(chapter_links.length + ' new chapters');

      saver.processPages(chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}