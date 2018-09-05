var path = require('path');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'NetTruyen',
  website: 'http://nettruyen.com',
  
  match: function(link, options) {
    return /nettruyen\.com/g.test(link) || /truyenchon\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'NetTruyen');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('.list-chapter').length > 0) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      var manga_title = $('h1.title-detail').text().trim();
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

      var chapter_links = saver.getLinks($, page, '.list-chapter', { 
        filters: ['/truyen-tranh/','/truyen/'] 
      });
      chapter_links.reverse();

      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('https', 'http')); 
      });
      chapter_links = chapter_links.filter(function(chapter_link) {
        return !saver.isDone(chapter_link.replace('truyenchon.com/truyen/', 'www.nettruyen.com/truyen-tranh/')); 
      });

      saver.downloadMangaChapters(chapter_links, options, callback);

    } else if ($('.page-chapter').length > 0) {
      var chapter_title = utils.replaceAll(page.title.trim(), ' - NetTruyen', '').trim();

      var chapter_images = saver.getImages($, page, '.page-chapter');
      if (options.debug) console.log(chapter_images);

      page.output_dir = path.join(options.output_dir, path.basename(path.dirname(page.url)));

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, callback);
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ((page.url.indexOf('/truyen-tranh/') > 0 || page.url.indexOf('/truyen/') > 0) 
      && $('.list-chapter').length > 0) {
      manga_info.url = page.url;
      manga_info.name = $('h1.title-detail').text().trim();
      manga_info.cover_image = $('.detail-info .col-image img').attr('src');
      manga_info.description = $('.detail-content p').first().text().trim();
      manga_info.last_updated_str = $('#item-detail time.small').first().text().trim();
      
      $('.detail-info .col-info .list-info li').each(function() {

        if ($(this).hasClass('othername')) {
          var alt_names_str = $(this).find('h2.other-name').text().trim();
          manga_info.alt_names = alt_names_str.split('; ');
        } else if ($(this).hasClass('author')) {
          var authors = [];
          $(this).find('a').each(function() {
            authors.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
          if (authors.length) manga_info.authors = authors;
        } else if ($(this).hasClass('status')) {
          manga_info.status = $(this).children('p').eq(1).text().trim();
        } else if ($(this).hasClass('kind')) {
          var genres = [];
          $(this).find('a').each(function() {
            genres.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
          if (genres.length) manga_info.genres = genres;
        } else {
          var info_key = $(this).find('p.name').text().trim();
          if (!info_key || info_key == '') return;

          var info_value = $(this).children('p').eq(1).text().trim();
          manga_info[info_key] = info_value;
        }
      });

      var manga_chapters = [];
      $('.list-chapter li.row .chapter').each(function() {
        var $chapter_link = $(this).find('a').first();
        manga_chapters.push({
          url: $chapter_link.attr('href'),
          title: $chapter_link.text().trim(),
          published_date_str: $(this).parent().children('div').eq(1).text().trim()
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
