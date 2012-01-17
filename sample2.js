// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var g_bgPage = chrome.extension.getBackgroundPage();
var g_docTitle = 'SL_vocabulary';
// would be updated in addWord()
var g_word = {};
var g_sentence = {};
var g_pageUrl = {};

// A generic onclick callback function.
function step2_addWord(resourceId)
{
	var d = new Date();
	var day = d.getDate();
	var mon = d.getMonth()+1;
	var yr = d.getFullYear();	
	var hr = d.getHours();
	var min = d.getMinutes();
	var sec = d.getSeconds();
	var time = mon + '/' + day + '/' + yr + ' ' + hr + ':' + min + ':' + sec;
 
	var atom = ["<?xml version='1.0' encoding='UTF-8'?>",
	'<entry xmlns="http://www.w3.org/2005/Atom"',
	'xmlns:gsx="http://schemas.google.com/spreadsheets/2006/extended">',
	'<gsx:time>', time, '</gsx:time>',
	'<gsx:word>', g_word, '</gsx:word>',
	'<gsx:sentence>', g_sentence, '</gsx:sentence>',
	'<gsx:url>', g_pageUrl, '</gsx:url>',
	'</entry>'].join(' ');
	
	var params = {
    'method': 'POST',
    'headers': {
      'GData-Version': '3.0',
      'Content-Type': 'application/atom+xml',
    },
    'parameters': {'alt': 'json'},
    'body': atom
	};

	console.log(resourceId);
	var url = 'https://spreadsheets.google.com/feeds/list/' + resourceId + '/1/private/full';

	// code 201 means 'data added'.
	var callbackAddwords = function(resp, xhr) {
	  if (xhr.status != 201) {
		alert('callbackAddwords::Error code: ' + xhr.status);
	  } else {
		alert("Done.\n\nwords: " + g_word + "\n\n" + 'sentence: "' + g_sentence + '"');
	  }
	}
	
	g_bgPage.oauth.authorize(function() {
		g_bgPage.oauth.sendSignedRequest(url, callbackAddwords, params);
	});
}

function callbackFindDocument(response, xhr) {
  if (xhr.status != 200) {
	alert('callbackFindDocument::Error code: ' + xhr.status);
    return;
  } 

  var data = JSON.parse(response);

	if (data.feed.entry)
	{
		console.log('document found');
		// check the first one only.
		entry = data.feed.entry[0];
		// get resource id (the first one)
		resourceId = entry.gd$resourceId.$t;
		var resourceIdSplit = resourceId.split(':');
		if (resourceIdSplit[0] == 'spreadsheet') 
		{
			id = resourceIdSplit[1];
			console.log(id);
			step2_addWord(id);
			// id got. return.
			return;
		}
	}
	
  // spreadsheet not found, creat a new one.
  {
	console.log('not found');
	
	var title = g_docTitle;
	var docType = 'spreadsheet';
	var content = 'time,word,sentence,url';
	
	var constructAtomXml_ = function(g_docTitle, docType, opt_starred) 
	{
		var starred = opt_starred || null;

		var starCat = ['<category scheme="http://schemas.google.com/g/2005/labels" ',
					 'term="http://schemas.google.com/g/2005/labels#starred" ',
					 'label="starred"/>'].join('');

		var atom = ["<?xml version='1.0' encoding='UTF-8'?>", 
				  '<entry xmlns="http://www.w3.org/2005/Atom">',
				  '<category scheme="http://schemas.google.com/g/2005#kind"', 
				  ' term="http://schemas.google.com/docs/2007#', docType, '"/>',
				  starred ? starCat : '',
				  '<title>', g_docTitle, '</title>',
				  '</entry>'].join('');
		return atom;
	};

	var constructContentBody_ = function(title, docType, body, contentType, opt_starred) 
	{
		var body = ['--END_OF_PART\r\n',
				  'Content-Type: application/atom+xml;\r\n\r\n',
				  constructAtomXml_(title, docType, opt_starred), '\r\n',
				  '--END_OF_PART\r\n',
				  'Content-Type: ', contentType, '\r\n\r\n',
				  body, '\r\n',
				  '--END_OF_PART--\r\n'].join('');
		return body;
	};

	var params = 
	{
		'method': 'POST',
		'headers': {
		  'GData-Version': '3.0',
		  'Content-Type': 'multipart/related; boundary=END_OF_PART',
		},
		'parameters': {'alt': 'json'},
		'body': constructContentBody_(title, docType, content, 'text/csv', false)
	};
	
	var callbackCreateDoc = function(resp, xhr) 
	{
		if (xhr.status != 201) 
		{
			alert('callbackCreateDoc::Error code: ' + xhr.status);
			return;
		}
		
		// TODO: add some user feedback. here the respoense may be slow, up to 10 sec. -ksl021111
		console.log('Document created!');
		// get documentid and add the word. note this actually is a recursive call!
		// however, once a document is created, the recursion stops.
		step1_findDocument(g_docTitle);
	};
	
	var url = 'https://docs.google.com/feeds/default/private/full';
	g_bgPage.oauth.sendSignedRequest(url, callbackCreateDoc, params);	
  }
};

function step1_findDocument(title)
{
	var params = {
		'headers': {
			'method': 'GET',
		  'GData-Version': '3.0'
		}
	};

	var url = 'https://docs.google.com/feeds/default/private/full';

    params['parameters'] = {
      'alt': 'json',
	  'title': title,
	  'title-exact': 'true'
    };
	
	g_bgPage.oauth.authorize(function() {
		g_bgPage.oauth.sendSignedRequest(url, callbackFindDocument, params);
		});

	return;
}

// A generic onclick callback function.
function addWord(_word, _sentence, _pageUrl)
{
	g_word = _word;
	g_sentence = _sentence;
	g_pageUrl = _pageUrl;

	step1_findDocument(g_docTitle);
}

function genericOnClick(info, tab) {
/*
  console.log("item " + info.menuItemId + " was clicked");
  console.log("info: " + JSON.stringify(info));
  console.log("tab: " + JSON.stringify(tab));
  alert("info: " + JSON.stringify(info));
  alert("info: " + info.selectionText);
*/  

	var word = prompt("What are the important words? (use comma to seperate)\n\n\"" + info.selectionText + '"', "");
	
	if (!word)
	{
		return false;
	}
	
	addWord(word, info.selectionText, info.pageUrl);
}

function addWordManually() 
{
	var sentence = prompt("What is the sentense?  (Use [] to mark the important words.)\n\n", "This is an [example].");
	if (!sentence)
	{
		return false;
	}
	
	// TODO: deal with multiple important words.	-ksl021011
	var left = sentence.search(/\[/);
	var right = sentence.search(/\]/);
	if (left == -1 || right == -1)
	{
		alert('cannot find important words');
		return false;
	}
	
	word = sentence.substring(left+1,right);
	// remove brackets: '[' and ']'
	sentence = sentence.substring(0,left)+sentence.substring(left+1,right)+sentence.substring(right+1);
	// send the data to google doc.
	addWord(word, sentence, "manual input");
}	  

// create menu item for "selection" type.
var id = chrome.contextMenus.create({
	"title": "Save selected texts to Google Docs",
	"contexts": ["selection"],
	"onclick": genericOnClick});
	
console.log("add 'selection' menu item:" + id);

