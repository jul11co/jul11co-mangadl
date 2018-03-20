var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MangaDex',
  website: 'https://mangadex.org',

  match: function(link, options) {
    return /mangadex\.com\/manga\//g.test(link) || /mangadex\.com\/chapter\//g.test(link)
      || /mangadex\.org\/manga\//g.test(link) || /mangadex\.org\/chapter\//g.test(link); 
    // MangaDex change domain from .com -> .org
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MangaDex');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (page.url.indexOf('/chapter/') > 0 
      &&  $('#current_page').length) {

      var selected_chapter = $('#jump_chapter').first().val().trim();
      var chapter_title = $('#jump_chapter option[value="' + selected_chapter + '"]').text().trim();
      var selected_group = $('#jump_group').first().val().trim();
      var group_name = $('#jump_group option[value="' + selected_group + '"]').text().trim();
      if (group_name) {
        chapter_title = chapter_title.trim() + ' [' + group_name.trim() + ']';
      }
      chapter_title = utils.replaceAll(chapter_title, '/', '-');
      chapter_title = utils.replaceAll(chapter_title, ':', ' -');

      console.log('Chapter title:', chapter_title);

      var chapter_script = $.html('script');
      if (!chapter_script) {
        console.log('No chapter script available');
        return callback();
      }

      var data_url = utils.extractSubstring(chapter_script, 'var dataurl =', ';');
      var pages_array = utils.extractSubstring(chapter_script, 'var page_array = [', '];');
      var image_server = utils.extractSubstring(chapter_script, 'var server =', ';');

      if (!data_url || !pages_array || !image_server) return callback();

      data_url = utils.replaceAll(data_url, '\'', '').trim();
      image_server = utils.replaceAll(image_server, '\'', '').trim();
      if (image_server.indexOf('/') == 0) {
        // image_server = 'https://mangadex.com' + image_server;
        image_server = 'https://mangadex.org' + image_server; // MangaDex change domain from .com -> .org
      }
      pages_array = utils.replaceAll(pages_array, '\r\n', '').trim();
      var pages = pages_array.split(',');

      // console.log(image_server, data_url, pages_array);

      var chapter_images = [];
      pages.forEach(function(page_image) {
        if (page_image) {
          page_image = utils.replaceAll(page_image, '\'', '');
          if (page_image) {
            chapter_images.push({
              src: image_server + data_url + '/' + page_image
            })
          }
        }
      });
      if (chapter_images.length == 0) return callback();

      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir));
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

    } else if (page.url.indexOf('/manga/') > 0 && $('#content').length) {
      console.log('Chapter list');

      var current_url = saver.getStateData('url') || '';

      if (options.auto_manga_dir && (!current_url || page.url.indexOf(current_url) != 0)) {
        var manga_title = $('#content h3.panel-title').first().text().trim();
        manga_title = utils.replaceAll(manga_title, ':', ' -');
        manga_title = utils.replaceAll(manga_title, '.', '_');
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      if (!current_url || (page.url.indexOf(current_url) != 0)) {
        saver.setStateData('url', page.url);
      }
      
      var chapter_links = saver.getLinks($, page, '#chapters', {
        filters: ['/chapter/']
      });

      console.log('Chapters: ' + chapter_links.length);

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link) 
          && !saver.isDone(chapter_link.replace('mangadex.org', 'mangadex.com')); 
        // MangaDex change domain from .com -> .org
      });
      console.log('New Chapters:', chapter_links.length);

      if ($('#chapters ul.pagination').length && $('#chapters ul.pagination li a').length) {
        $('#chapters ul.pagination li a').each(function() {
          var pagination_link = $(this).attr('href');
          if (pagination_link && chapter_links.indexOf(pagination_link) == -1) {
            chapter_links.push(pagination_link);
          }
        });
      }
      if (options.verbose) console.log(chapter_links);

      saver.processPages(chapter_links, options, callback);
    } else {
      callback();
    }
  }
}