var path = require('path');

module.exports = {
  
  name: 'Blogtruyen',
  website: 'http://blogtruyen.com',

  match: function(link, options) {
    return /blogtruyen\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {
    
    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Blogtruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.al-c.linkchapter').length) {

      var chapter_title = $('header h1').eq(0).text();

      var chapter_images = saver.getImages($, page, 'article#content');
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

    } else if ($('#list-chapters').length) {

      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Blogtruyen');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = page.title.replace('| BlogTruyen.Com', '').trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }
      
      saver.setStateData('url', page.url);

      $('#list-chapters .download').remove();
      page.chapter_links = saver.getLinks($, page, '#list-chapters', { /*filters: ['/truyen/']*/ });
      if (options.verbose) console.log(page.chapter_links);

      console.log('Chapters:', page.chapter_links.length);

      var chapter_links = page.chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);

      saver.processPages(chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}