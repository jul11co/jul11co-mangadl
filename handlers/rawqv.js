var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'RawQV',
  website: 'https://rawqv.com',

  match: function(link, options) {
    return /rawqv\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'RawQV');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.chapter-content').length) {

      var chapter_title = $('.chapter-content-top ol.breadcrumb li').last().text().trim();
      if (chapter_title) {
        chapter_title = chapter_title.replace('- ', '');
        chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      }

      // console.log('Chapter title:', chapter_title);

      var chapter_images = [];
      $('.chapter-content .chapter-content > div').remove();
      $('.chapter-content > a > img.chapter-img').remove();
      if ($('.chapter-content #chapter-imgs').length) {
        var image_src = $(this).attr('data-original');
        if (image_src) {
          chapter_images.push({
            src: image_src,
            file: path.basename(image_src)
          });
        }
      } else {
        chapter_images = saver.getImages($, page, '.chapter-content');
      }
      if (chapter_images.length == 0) return callback();
      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir, '.html'));
      }
      
      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if ($('#tab-chapper').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.info-manga ol.breadcrumb li').last().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      console.log('Manga title: ' + manga_title);
      // console.log('Chapter list');

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

      // var chapter_links = saver.getLinks($, page, '#tab-chapper');
      var chapter_links = [];
      $('#tab-chapper table tr').each(function() {
        var chapter_url = $(this).children('td').eq(0).children('a').attr('href');
        if (chapter_url) chapter_links.push(chapter_url);        
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('#tab-chapper').length) {
      manga_info = {};
      manga_info.url = page.url;
      manga_info.name = $('.breadcrumb li a').last().children('span').text().trim();
      if (!manga_info.name) {
        manga_info.name = $('.breadcrumb li a').last().attr('title');
      }
      manga_info.name = utils.replaceAll(manga_info.name, '- Raw', '').trim();

      manga_info.cover_image = $('.info-cover img.thumbnail').attr('src');
      if (manga_info.cover_image && manga_info.cover_image.indexOf('http') != 0) {
        if (page.manga.cover_image.indexOf('/') == 0 && page.manga.cover_image.indexOf('//') != 0) {
          page.manga.cover_image = 'https://rawqv.com/' + page.manga.cover_image;
        }
      }

      manga_info.description = $('.info-manga').children('div').first()
        .children('div.row').eq(1).children('p').first().text().trim();

      $('ul.manga-info li').each(function() {
        if ($(this).find('b').length == 0) return;

        var info_key = $(this).find('b').first().text().trim();
        if (info_key == 'Other names') {
          $(this).find('b').remove();
          var other_names = $(this).text().replace(':','').trim().split(',');
          manga_info.alt_names = other_names.map(function(name) {
            return name.trim();
          });
          manga_info.alt_names = manga_info.alt_names.filter(function(name) {
            return name != 'Updating';
          });
        } else if (info_key == 'Author(s)') {
          var authors = [];
          $(this).find('a').each(function() {
            authors.push($(this).text().trim());
          });
          manga_info.authors = authors;
        } else if (info_key == 'Genre(s)') {
          var genres = [];
          $(this).find('a').each(function() {
            genres.push($(this).text().trim());
          });
          manga_info.genres = genres;
        } else if (info_key == 'Status') {
          // $(this).find('b').remove();
          var status_str = $(this).find('a').first().text().trim();
          manga_info.status = status_str;
        } else if (info_key == 'Views') {
          $(this).find('b').remove();
          var views_str = $(this).text().replace(':','').trim();
          manga_info.views = parseInt(views_str);
        }
      });

      var manga_chapters = [];
      $('#tab-chapper table tr').each(function() {
        manga_chapters.push({
          url: $(this).children('td').eq(0).children('a').attr('href'),
          title: $(this).children('td').eq(0).children('a').text().trim(),
          published_date_str: $(this).children('td').eq(1).text()
        });
      });

      manga_info.chapter_count = manga_chapters.length;
      
      if (options.include_chapters || options.with_chapters) {
        manga_info.chapters = manga_chapters;
      }
          
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