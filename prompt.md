Help me generate a chrome extension

user can use a http endpoint as input, the extension will watch the request, if the request match the endpoint, the extension then can execute next action which user defined.

supported action: 
- user can paste a js code which has a entrypoint function named index to extension, extension will use the http response as the function's input, and then show the result what the index function returned
