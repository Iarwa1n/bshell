var b_gui = function(shell)
{
	this.shell = shell;
	this.show = function()
	{

	}
}

var b_shell = function(config)
{
	var v = new Object(); // all variables
	var h = new Array(); //history
	var c = new Object(); //all known commands

	var config = config || [];
	c.test = function(cmd, input, params, shell)
	{
		console.log("i am " + cmd);
		console.log("i got " + input.length + " inputs");
		console.log("my params are " + params);
		return true; 	
	}
	
	c.max = function(cmd, input, params, shell)
	{
		if (!input.length) {
			return false;
		}

		var abs = function(num) {
			return (params.abs == "true") ? Math.abs(parseFloat(num)) : parseFloat(num);
		}		
		max = abs(input[0]);		 
		for( var i = 0; i < input.length; i++) {
			max = (abs(input[i]) > max) ? abs(input[i]) : max;
		}
		return max;
	}


	c.links = function(cmd, input, params, shell)
	{
		function createDocument(html, title) {
		  var doc = document.implementation.createHTMLDocument(title);
		  doc.documentElement.innerHTML = html;
		  return doc;
		}

		if(input.length == 0) {
			renderLinks();
		} else {
			var _html = shell.exec(":bg load " + input[0]);
			var doc = createDocument(_html, "test");
			console.log(doc.links);
			return doc.links;
		}
	}

	c.load = function(cmd, input, params, shell)
	{
		console.log(shell);
		console.log(input);
		var _html = shell.exec(":bg load " + input[0]);
		var newDoc = top.frames[1].document.open("text/html", "replace");
		newDoc.write(_html);
		newDoc.close();
	}

	c['!'] = function(cmd, input, params, shell)
	{
		var cmd = shell.exec(":bg history " + input[0]);
		return shell.exec(cmd);			
	}
	
	/**
	* adds a command to the shell
	*/
	this.addCommand = function(command, call_back)
	{
		if(typeof call_back != "function") {
			return false;
		}
		c[command] = call_back;
		return true;
	}
	
	this.addVariable = function(key, value)
	{
		v[key] = value;
	}

	/**
	*folds double quoted texts to variables to ease tokenizing
	*/
	this.foldQuoted = function(cl_orig, cl, state, _start, _end, var_cnt, tokens) {
		
		if (cl.length == 0) {
			//console.log(cl_orig, tokens);
			return [cl_orig, tokens];
		}
		var letter = cl.shift();
		
		switch(state) {
			case 0:
				switch(letter) {
					case " ":
						break;
					case '"':
						state = 1;       //start found
						_end = _start;
						break;
					default:
						 break;
				}
				break;
			case 1:
				switch(letter) {
					case " ":
						break;
					case '"': //end found
						tokens[var_cnt] = cl_orig.slice(_start+1, _end); 
						cl_orig = cl_orig.slice(0, _start) + "$_" + (var_cnt++) + cl_orig.slice(_end+1);						
						_start 	= _start + 3; //variable name shift
						_end 	= 0;
						state 	= 0;
						break;
					case "\\":
						state = 2;						
					default:
						break;						
				}
				break;					
			case 2:
				//always go on
				state = 1;
				break;							 
		}
		
		if(_end == 0) {
			_start++;
		} else {
			_end++;
		}
		//console.log(cl_orig, cl, state, _start, _end, var_cnt, tokens);		
		return this.foldQuoted(cl_orig, cl, state, _start, _end, var_cnt, tokens);
	}
	
	
	/**
	* parses the command after quoted textes have been folded
	* cl the command line
	**/	
	this.parse = function(cl)
	{
		cl = cl.replace(/^\s+|\s+$/g,"") //trim whitespace from beginning and end
		var foldQuotes = this.foldQuoted(cl,cl.split(''), 0, 0, 0, 10, new Object()); //fold quotes to vars
		var pipe = foldQuotes[0].split('|'); //split pipe
		var tokens = pipe.shift().replace(/^\s+|\s+$/g,"").split(/\s+/); //tokenize first in pipe, pipe the rest
		var unfoldVars = function(key)
		{
			//return key;
			if (key.match(/^\$_/)) {
				if (foldQuotes[1][key.slice(2)]) {
					return foldQuotes[1][key.slice(2)];
				} 
			}
			
			if (key.match(/^\$/)) {
				if (v[key.slice(1)]) {
					return v[key.slice(1)];
				} 
			}
			return key;
		}
		
		var command = tokens.shift();

		var params = new Object();
		var input  = new Array();
		for (var i=0; i < tokens.length; i++) {
			var param = tokens[i].split("=");
			if (param.length == 2) {
				params[unfoldVars(param[0])] = unfoldVars(param[1]);	
			} else {
				input.push(unfoldVars(tokens[i]));
			}
		}
		return [command, input, params, pipe];	
	}
	
	/**
	* executes a given command_line
	**/
	this.exec = function(cl)
	{
		var orig_cl = cl;
		cl = cl.replace(/^\s+|\s+$/g,"") //trim whitespace from beginning and end
		var languageSpace = cl.match(/^:.+?\s+/)
		if(languageSpace != null) {
			languageSpace = languageSpace[0];
		} else {
			languageSpace = '';
		}
		cl = cl.slice(languageSpace.length);	
		languageSpace = languageSpace.replace(/\s+$/g,"");
		var result = undefined;
		switch (languageSpace) {
			case ":js": 
				result = eval(cl);
				break;
			case ":bg":
				var parser = this.parse(cl);
				console.log(parser);
				var result = this.getFromBackend(parser[0], parser[1], parser[2]);
				break;
			default:
				var parser = this.parse(cl);
				console.log(parser);
				if (c[parser[0]]) {
					var result = c[parser[0]](parser[0], parser[1], parser[2], this);			
					if (parser[3].length) {
						this.addVariable('PIPE', result);
						result = this.exec(parser[3].shift() + ' $PIPE' + parser[3].join());
					}
					break;
				}
				break;
		}
		if (orig_cl.indexOf("save_history") < 0) { // dont save the history command in the history
			var his_command = ":bg save_history \"" + orig_cl + "\"";
			this.exec(his_command);
		}

		return result;
	}

	this.getFromBackend = function(cmd, input, params)
	{
		var url = config.backend_url || "http://host.local/bshell/backend.php";

		var postParams = "cmd=" + cmd + "&input=" + input.join(" ");
		for (var param in params) {
			postParams += "&" + param + params[param];
		}
		console.log(postParams);
		http = this.httpObj();
		http.open("POST", url, false );
		http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		//http.setRequestHeader("Content-length", params.length);
		//http.setRequestHeader("Connection", "close");
		/*
		http.onreadystatechange = function() {//Call a function when the state changes.
			if(http.readyState == 4 && http.status == 200) {
				return http.responseText;
				var newDoc = top.frames[1].document.open("text/html", "replace");
				newDoc.write(http.responseText);
				newDoc.close();
				
			}
		}
		*/
		http.send(postParams);
		return http.responseText;
	}

	this.httpObj = function()
	{
	    var xmlhttp = null;
	    // Mozilla
	    if (window.XMLHttpRequest) {
	        xmlhttp = new XMLHttpRequest();
	    }
	    // IE
	    else if (window.ActiveXObject) {
	        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	    }
		return xmlhttp;
	}
}

s = new b_shell();
//alert("shell loaded");