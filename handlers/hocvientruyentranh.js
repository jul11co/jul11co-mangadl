var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Hocvientruyentranh',
  website: 'http://hocvientruyentranh.com',

  match: function(link, options) {
    return /hocvientruyentranh\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Hocvientruyentranh');
      saver.setMangaOutputDir(options.output_dir);
    }

    if (page.url.indexOf('/manga/') > 0) {
      console.log('Chapter list');
      
      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Truyen.AcademyVN');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('.box-manga .__info-container .__info h3.__name').text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '.box .table-scroll', { 
        filters: ['/chapter/'] 
      });
      if (options.verbose) console.log(page.chapter_links);

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else if (page.url.indexOf('/chapter/') > 0) {
      var chapter_title = utils.replaceAll(page.title.trim(), '| Học Viện Truyện Tranh', '').trim();

      var chapter_images = saver.getImages($, page, '.manga-container');
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
    } else {
      callback();
    }
  }
}