FROM golang:1.22-alpine
WORKDIR /app
COPY . .
RUN go mod download
RUN go get .
RUN go build -o main .
CMD ["./main"] 