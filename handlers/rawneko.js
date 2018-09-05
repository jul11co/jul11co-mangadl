var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'RawNeko',
  website: 'http://rawneko.com',

  match: function(link, options) {
    return /rawneko\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'RawNeko');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('.read-container').length) {

      var chapter_title = $('.entry-header_wrap ol.breadcrumb li').last().text().trim();
      if (chapter_title) {
        chapter_title = chapter_title.replace('- ', '');
        chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      }

      // console.log('Chapter title:', chapter_title);

      var chapter_images = saver.getImages($, page, '.read-container .page-break');
      if (chapter_images.length == 0) return callback();
      if (options.verbose) console.log(chapter_images);

      var chapter_output_dir = '';
      if (chapter_title) {
        chapter_output_dir = path.join(options.output_dir, chapter_title);
      } else {
        chapter_output_dir = path.join(options.output_dir, path.basename(page.output_dir));
      }
      
      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: chapter_output_dir
      }, options, callback);

    } else if ($('.profile-manga').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('.profile-manga .post-title h3').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
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

      var chapter_links = saver.getLinks($, page, '.listing-chapters_wrap', {
        filters: [
          'rawneko.com/manga/'
        ]
      });

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('?style=list', '/?style=list')); 
      });

      saver.downloadMangaChapters(chapter_links, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.profile-manga').length) {
      manga_info = {};
      manga_info.url = page.url;
      manga_info.name = $('.profile-manga .post-title h3').first().text().trim();
      manga_info.name = utils.replaceAll(manga_info.name, ' raw', '').trim();

      manga_info.cover_image = $('.profile-manga .summary_image img').attr('data-src');

      $('.description-summary .summary__content .tptn_counter').remove();
      manga_info.description = $('.description-summary .summary__content').first().text().trim();

      $('.profile-manga .summary_content_wrap .post-content .post-content_item').each(function() {
        var info_key = $(this).find('.summary-heading').first().text().trim();
        if (info_key == 'Alternative') {
          var other_names = $(this).find('.summary-content').text().trim().split(',');
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
            genres.push($(this).text().split('|')[0].trim());
          });
          manga_info.genres = genres;
        }
      });
      $('.profile-manga .summary_content_wrap .post-status .post-content_item').each(function() {
        var info_key = $(this).find('.summary-heading').first().text().trim();
        if (info_key == 'Status') {
          var status_str = $(this).find('.summary-content').text().trim();
          if (status_str == 'OnGoing') status_str = 'Ongoing';
          manga_info.status = status_str;
        } else if (info_key == 'Release') {
          var release_str = $(this).find('.summary-content').text().trim();
          manga_info.release = release_str;
        }
      });

      var manga_chapters = [];
      $('.listing-chapters_wrap .wp-manga-chapter').each(function() {
        manga_chapters.push({
          url: $(this).children('a').attr('href'),
          title: $(this).children('a').text().trim(),
          published_date_str: $(this).children('span.chapter-release-date').eq(0).text()
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