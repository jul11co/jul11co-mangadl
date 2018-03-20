var path = require('path');

module.exports = {
  
  name: 'TruyenTranh.net',
  website: 'http://truyentranh.net',

  match: function(link, options) {
    return /truyentranh\.net/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranh.net');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.each-page').length) {
      var chapter_title = $('.chapter-title').eq(0).text().trim();
      
      var chapter_images = saver.getImages($, page, '.each-page');
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

    } else if ($('.total-chapter').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'TruyenTranh.net');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('h1.title-manga').first().text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '#examples .content');
      page.chapter_links.sort(function(a, b){
        if(a.toLowerCase() < b.toLowerCase()) return -1;
        if(a.toLowerCase() > b.toLowerCase()) return 1;
        return 0;
      });
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