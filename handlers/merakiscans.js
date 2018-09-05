var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'MerakiScans',
  website: 'http://merakiscans.com',

  match: function(link, options) {
    return /merakiscans\.com\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'MerakiScans');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if ($('#singleWrap').length && $('#singleWrap').length) {

      $('.wpm_pag.mng_rdr h1.ttl a').first().remove();
      var chapter_title = $('.wpm_pag.mng_rdr h1.ttl').first().text().trim();
      if (chapter_title) {
        chapter_title = chapter_title.replace('- ', '');
        chapter_title = utils.replaceAll(chapter_title, ':', ' -');
      }

      // console.log('Chapter title:', chapter_title);

      var chapter_images = saver.getImages($, page, '#longWrap');
      if (chapter_images.length == 0) return callback();

      if (options.debug) console.log(chapter_images);

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
      }, options, callback);

    } else if ($('.mng_det').length && $('.lst.mng_chp').length) {
      console.log('----');
      console.log('Manga page: ' + page.url);

      // var manga_title = page.title.trim();
      // manga_title = manga_title.replace(' - Manga Detail Meraki Scans','').trim();
      var manga_title = $('.mng_det h1.ttl').first().text().trim();
      manga_title = utils.replaceAll(manga_title, ':', ' -');
      console.log('Manga title: ' + manga_title);
      if (options.debug) console.log('Chapter list');

      if (options.auto_manga_dir && page.url.indexOf('/chapter-list/') == -1) {
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

      var chapter_links = saver.getLinks($, page, '.lst.mng_chp li');

      var chapter_list_pages = [];
      if ($('ul.pgg').length && $('ul.pgg li a').length) {
        $('ul.pgg li a').each(function() {
          var chapter_list_page = $(this).attr('href');
          if (chapter_list_page && chapter_list_page != '#' 
            && chapter_list_pages.indexOf(chapter_list_page) == -1) {
            chapter_list_pages.push(chapter_list_page);
          }
        });
      }

      saver.downloadMangaChapters(chapter_links, options, function(err) {
        if (err) return callback(err);

        if (chapter_list_pages.length) {
          saver.processPages(chapter_list_pages, options, callback);
        } else {
          callback();
        }
      });
    } else {
      callback();
    }
  },

  getMangaInfo: function($, page, options) {
    var manga_info = {};
    if ($('.mng_det').length && $('.lst.mng_chp').length) {
      manga_info.url = page.url;
      manga_info.name = $('.mng_det h1.ttl').first().text().trim();
      manga_info.cover_image = $('.mng_det .mng_ifo img.cvr').attr('src');
      
      $('.mng_det .mng_ifo div p').each(function(idx) {
        var info_str = $(this).text().trim();

        if (info_str.indexOf('Alternative Name:') == 0) {
          manga_info.alt_names = info_str.replace('Alternative Name:','').trim().split(', ');
        }
        else if (info_str.indexOf('Author:') == 0) {
          manga_info.authors = [];
          $(this).find('a').each(function() {
            manga_info.authors.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
        } 
        else if (info_str.indexOf('Status:') == 0) {
          manga_info.status = info_str.replace('Status:','').trim();
        } 
        else if (info_str.indexOf('Category:') == 0) {
          manga_info.genres = [];
          $(this).find('a').each(function() {
            manga_info.genres.push({
              name: $(this).text().trim(),
              url: $(this).attr('href')
            });
          });
        } 
        else if (info_str.indexOf('Reading Direction:') == 0) {
          manga_info.reading_direction = info_str.replace('Reading Direction:','').trim();
        } 
        else if (info_str.indexOf('Total views:') == 0) {
          var views_str = info_str.replace('Total views:','').trim();
          manga_info.views = parseInt(views_str);
        } 
        else if (info_str.indexOf('Rank:') == 0) {
          manga_info.rank = info_str.replace('Rank:','').trim();
        } 
        else if (info_str.indexOf('Subscribe:') == 0) {
          manga_info.rss_url = $(this).find('a').first().attr('href');
        } 
        else if (info_str.indexOf('Date Added:') == 0) {
          manga_info.added_date_str = info_str.replace('Date Added:','').trim();
        } 
        else if (idx == 0) {
          manga_info.description = info_str;
        }
      });
      
      var manga_chapters = [];
      $('.lst.mng_chp li a.lst').each(function() {
        manga_chapters.push({
          url: $(this).attr('href'),
          title: $(this).children('b.val').text().trim(),
          published_date_str: $(this).children('b.dte').text().trim()
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
    