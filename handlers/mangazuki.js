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
      }, options, callback);

    } else if (page.url.indexOf('mangazuki.co/manga/') > 0 &&  $('ul.chapters').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      // var manga_title = page.title.replace('Mangazuki - ','');
      // manga_title = manga_title.replace('Mangazuki Raws - ','').trim();
      var manga_title = $('h2.widget-title').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      manga_title = utils.replaceAll(manga_title, '.', '_');
      if (page.url.indexOf('raws.mangazuki.co/manga/') > 0) {
        manga_title += ' [Raw]';
      }
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      if (options.save_index_html) {
        saver.saveHtmlSync(path.join(options.output_dir, 'index.html'), $.html());
      }
      var manga_info = this.getMangaInfo($, page, options);
      if (manga_info && manga_info.url) {
        saver.saveJsonSync(path.join(options.output_dir, 'manga.json'), manga_info);
      }

      if (options.update_info_only) {
        return callback();
      }

      var chapter_links = saver.getLinks($, page, 'ul.chapters', {
        filters: [
          'https://mangazuki.co/manga/',
          'https://raws.mangazuki.co/manga/'
        ]
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },
  
  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if (page.url.indexOf('mangazuki.co/manga/') > 0 &&  $('ul.chapters').length) {
      manga_info.url = page.url;
      manga_info.name = $('h2.widget-title').first().text().trim();
      if (page.url.indexOf('raws.mangazuki.co/manga/') > 0) {
        manga_info.name += ' [Raw]';
      }
      manga_info.cover_image = $('.boxed img.img-responsive').first().attr('src');
      $('.boxed h5').each(function() {
        if ($(this).text().trim() == 'Summary') {
          manga_info.description = $(this).next().text().trim();
        }
      });

      var info_keys = [];
      $('.boxed dl.dl-horizontal dt').each(function() {
        var info_key = $(this).text().trim();
        if (info_key == 'Type') {
          manga_info.type = $(this).next().text().trim();
        } else if (info_key == 'Status') {
          manga_info.status = $(this).next().text().trim();
        } else if (info_key == 'Other names') {
          manga_info.alt_names = [];
          manga_info.alt_names.push($(this).next().text().trim());
        } else if (info_key == 'Author(s)') {
          manga_info.authors = [];
          if ($(this).next().find('a').length) {
            $(this).next().find('a').each(function() {
              manga_info.authors.push($(this).text().trim());
            });
          } else {
            manga_info.authors.push($(this).next().text().trim());
          }
        } else if (info_key == 'Artist(s)') {
          manga_info.artists = [];
          if ($(this).next().find('a').length) {
            $(this).next().find('a').each(function() {
              manga_info.artists.push($(this).text().trim());
            });
          } else {
            manga_info.artists.push($(this).next().text().trim());
          }
        } else if (info_key == 'Date of release') {
          manga_info.release_date_str = $(this).next().text().trim();
        } else if (info_key == 'Categories') {
          manga_info.genres = [];
          $(this).next().find('a').each(function() {
            manga_info.genres.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
        } else if (info_key == 'Tags') {
          manga_info.tags = [];
          $(this).next().find('a').each(function() {
            manga_info.tags.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
        } else if (info_key == 'Views') {
          manga_info.views = parseInt($(this).next().text().trim());
        } 
      });

      if (page.url.indexOf('raws.mangazuki.co/manga/') > 0) {
        manga_info.tags = manga_info.tags || [];
        manga_info.tags.push('Raw');
      }

      var manga_chapters = [];
      $('.chapters li').each(function() {
        var $chapter_link = $(this).find('.chapter-title-rtl').children('a').first();
        manga_chapters.push({
          url: $chapter_link.attr('href'),
          title: $chapter_link.text().trim(),
          published_date_str: $(this).find('.date-chapter-title-rtl').text().trim()
        });
      });

      manga_info.chapter_count = manga_chapters.length;
      
      if (options.verbose) {
        console.log('Manga:');
        console.log('    Name: ' + manga_info.name);
        console.log('    Cover image: ' + manga_info.cover_image);
        // console.log('    Description: ' + manga_info.description);
        console.log('    Authors: ' + manga_info.authors);
        console.log('    Genres: ' + manga_info.genres);
        console.log('    Status: ' + manga_info.status);
        console.log('    Chapter count: ' + manga_info.chapter_count);
      }
    }
    return manga_info;
  }
}
