var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'PsychoPlay',
  website: 'https://psychoplay.co',

  match: function(link, options) {
    return /psychoplay\.co\/series\//g.test(link) || /psychoplay\.co\/read\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'PsychoPlay');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('psychoplay.co/read/') > 0 &&  $('.img-lazy').length) {

      var chapter_title = page.title.replace('Psycho Play - ','').trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      // Get images on current page
      var chapter_images = [];
      $('.page-content img.img-lazy.img-responsive').each(function() {
        var image_src = $(this).attr('data-src');
        if (image_src) {
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      if (options.debug) console.log(chapter_images);

      var chapter_output_dir = '';
      // chapter_output_dir = path.join(options.output_dir, 
      //   path.basename(path.dirname(page.output_dir)) + '-' + path.basename(page.output_dir));
      chapter_output_dir = path.join(options.output_dir, chapter_title);
      
      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if (page.url.indexOf('psychoplay.co/series/') > 0 &&  $('.profile-cover').length) {
      console.log('Chapter list');

      if (options.auto_manga_dir && page.url.indexOf('page=') == -1) {
        var manga_title = page.title.replace('Psycho Play - ','');
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        manga_title = utils.replaceAll(manga_title, '.', '_');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      if (page.url.indexOf('page=') == -1) {
        saver.setStateData('url', page.url);
      }

      var chapter_links = saver.getLinks($, page, '.media-list', {
        filters: [
          'https://psychoplay.co/read/'
        ]
      });

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);

      if ($('.pagination').length && $('.pagination li.next a').length) {
        var next_link = $('.pagination li.next a').attr('href');
        if (next_link && next_link != '') chapter_links.push(next_link);
      }
      if (options.debug) console.log(chapter_links);

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}