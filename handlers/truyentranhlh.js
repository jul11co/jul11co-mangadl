var path = require('path');

module.exports = {
  
  name: 'TruyentranhLH',
  website: 'http://truyentranhlh.com',

  match: function(link, options) {
    return /truyentranhlh\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyentranhLH');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.chapter-content').length) {
      var chapter_title = $('.tieude').first().text().trim();
      var chapter_url = page.url;

      var chapter_images = [];//saver.getImages($, page, image_container);
      $('img.chapter-img').each(function() {
        var img_src = $(this).attr('src');
        chapter_images.push({
          src: img_src
        });
      });
      if (options.verbose) console.log(chapter_images);

      page.output_dir = path.join(path.dirname(page.output_dir), path.basename(page.output_dir,'.html'));

      saver.downloadMangaChapter({
        chapter_url: chapter_url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('#tab-chapper').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'TruyentranhLH');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = page.title.split('-')[0].trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '#tab-chapper');
      if (options.verbose) console.log(page.chapter_links);

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, callback);

    } else {
      callback();
    }
  }
}