var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Mangazuki',
  website: 'http://mangazuki.co',

  match: function(link, options) {
    return /mangazuki\.co\/manga\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Mangazuki');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('mangazuki.co/manga/') > 0 
      &&  $('.viewer-cnt').length) {

      var chapter_title = page.title.replace('Mangazuki - ','').trim();
      chapter_title = chapter_title.replace('Mangazuki Raws - ','').trim();
      chapter_title = chapter_title.split(' - Page ')[0].trim();
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      if (page.url.indexOf('raws.mangazuki.co') > 0) {
        chapter_title += ' [Raw]';
      }

      // Get images on current page
      var chapter_images = [];
      $('#all img.img-responsive').each(function() {
        var image_src = $(this).attr('data-src');
        if (image_src) {
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      });
      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      // chapter_output_dir = path.join(options.output_dir, 
      //   path.basename(path.dirname(page.output_dir)) + '-' + path.basename(page.output_dir));
      chapter_output_dir = path.join(options.output_dir, chapter_title);
      
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

    } else if (page.url.indexOf('mangazuki.co/manga/') > 0 
      &&  $('ul.chapters').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'Mangazuki');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        // var manga_title = page.title.replace('Mangazuki - ','');
        // manga_title = manga_title.replace('Mangazuki Raws - ','').trim();
        var manga_title = $('h2.widget-title').first().text().trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        manga_title = utils.replaceAll(manga_title, '.', '_');
        if (page.url.indexOf('raws.mangazuki.co/manga/') > 0) {
          manga_title += ' [Raw]';
        }
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      var chapter_links = saver.getLinks($, page, 'ul.chapters', {
        filters: [
          'https://mangazuki.co/manga/',
          'https://raws.mangazuki.co/manga/'
        ]
      });

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link);
      });
      console.log('New Chapters:', chapter_links.length);

      // if ($('.pagination').length && $('.pagination li.next a').length) {
      //   var next_link = $('.pagination li.next a').attr('href');
      //   if (next_link && next_link != '') chapter_links.push(next_link);
      // }
      if (options.verbose) console.log(chapter_links);

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}