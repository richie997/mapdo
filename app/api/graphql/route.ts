import { ApolloServer } from "@apollo/server";
import { PrismaClient } from "@prisma/client";
import { PubSubEngine, PubSub } from "graphql-subscriptions";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql";

const prisma = new PrismaClient();
const pubsub: PubSubEngine = new PubSub();

// Grahql Schema
const typeDefs = `#graphql
 scalar DateTime
 scalar Json

 type User {
  id: ID!
  name: String!
  email: String!
  role: String!
  maps: [Map!]
  subscriptions: [Subscription!]
  favorites: [Favorite!]
  history: [NavigationHistory!]
  comments: [Comment!]
  styles: [MapStyle!]
}

type Map {
  id: ID!
  name: String!
  type: String!
  owner: User!
  places: [Place!]
  routes: [Route!]
  traffic: [TrafficData!]
  weather: [WeatherData!]
  events: [Event!]
}

type Place {
  id: ID!
  name: String!
  type: String!
  latitude: Float!
  longitude: Float!
  map: Map!
  media: [Media!]
  comments: [Comment!]
  favorites: [Favorite!]
}

type Route {
  id: ID!
  name: String!
  originId: String!
  destinationId: String!
  distance: Float!
  duration: Int!
  map: Map!
  comments: [Comment!]
  favorites: [Favorite!]
}

type Favorite {
  id: ID!
  user: User!
  place: Place
  route: Route
}

type Subscription {
  id: ID!
  user: User!
  planType: String!
  expiration: DateTime!
}

type TrafficData {
  id: ID!
  trafficLevel: String!
  timestamp: DateTime!
  map: Map!
}

type WeatherData {
  id: ID!
  temperature: Float!
  conditions: String!
  timestamp: DateTime!
  map: Map!
}

type Comment {
  id: ID!
  user: User!
  text: String!
  rating: Int!
  place: Place
  route: Route
}

type Media {
  id: ID!
  url: String!
  type: String!
  place: Place
}

type NavigationHistory {
  id: ID!
  user: User!
  timestamp: DateTime!
  action: String!
  details: String
}

type MapStyle {
  id: ID!
  user: User!
  name: String!
  style: Json!
  isDefault: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Event {
  id: ID!
  name: String!
  description: String
  startTime: DateTime!
  endTime: DateTime!
  map: Map!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# -----------------------------
# Queries
# -----------------------------
type Query {
  users: [User!]
  maps: [Map!]
  places: [Place!]
  routes: [Route!]
  favorites: [Favorite!]
  subscriptions: [Subscription!]
  trafficData: [TrafficData!]
  weatherData: [WeatherData!]
  comments: [Comment!]
  media: [Media!]
  navigationHistory: [NavigationHistory!]
  mapStyles: [MapStyle!]
  events: [Event!]
}

# -----------------------------
# Mutations
# -----------------------------
type Mutation {
  createUser(name: String!, email: String!, password: String!): User!
  createMap(name: String!, type: String!, ownerId: ID!): Map!
  createPlace(name: String!, type: String!, latitude: Float!, longitude: Float!, mapId: ID!): Place!
  createRoute(name: String!, originId: ID!, destinationId: ID!, distance: Float!, duration: Int!, mapId: ID!): Route!
  createFavorite(userId: ID!, placeId: ID, routeId: ID): Favorite!
  createSubscription(userId: ID!, planType: String!, expiration: DateTime!): Subscription!
  createTrafficData(trafficLevel: String!, mapId: ID!): TrafficData!
  createWeatherData(temperature: Float!, conditions: String!, mapId: ID!): WeatherData!
  createComment(userId: ID!, text: String!, rating: Int!, placeId: ID, routeId: ID): Comment!
  createMedia(url: String!, type: String!, placeId: ID!): Media!
  createNavigationHistory(userId: ID!, action: String!, details: String): NavigationHistory!
  createMapStyle(userId: ID!, name: String!, style: Json!, isDefault: Boolean!): MapStyle!
  createEvent(name: String!, description: String, startTime: DateTime!, endTime: DateTime!, mapId: ID!): Event!

  updateUser(id: ID!, name: String, email: String, password: String): User!
  updateMap(id: ID!, name: String, type: String): Map!
  updatePlace(id: ID!, name: String, type: String, latitude: Float, longitude: Float): Place!
  updateRoute(id: ID!, name: String, distance: Float, duration: Int): Route!
  updateTrafficData(id: ID!, trafficLevel: String!): TrafficData!
  updateWeatherData(id: ID!, temperature: Float!, conditions: String!): WeatherData!
  updateComment(id: ID!, text: String, rating: Int): Comment!
  updateEvent(id: ID!, name: String, description: String, startTime: DateTime, endTime: DateTime): Event!

  deleteUser(id: ID!): User!
  deleteMap(id: ID!): Map!
  deletePlace(id: ID!): Place!
  deleteRoute(id: ID!): Route!
  deleteFavorite(id: ID!): Favorite!
  deleteSubscription(id: ID!): Subscription!
  deleteTrafficData(id: ID!): TrafficData!
  deleteWeatherData(id: ID!): WeatherData!
  deleteComment(id: ID!): Comment!
  deleteMedia(id: ID!): Media!
  deleteNavigationHistory(id: ID!): NavigationHistory!
  deleteMapStyle(id: ID!): MapStyle!
  deleteEvent(id: ID!): Event!
}

# -----------------------------
# Subscriptions (Real-time Updates)
# -----------------------------
type Subscription {
  trafficUpdated: TrafficData!
  weatherUpdated: WeatherData!
}

`;

// ✅ Define Custom Scalar Resolvers
const dateTimeScalar = new GraphQLScalarType({
    name: "DateTime",
    description: "A valid date-time value",
    serialize(value) {
      return value instanceof Date ? value.toISOString() : null;
    },
    parseValue(value: unknown) {
      return new Date(value as string | number);
    },
    parseLiteral(ast) {
      return ast.kind === Kind.STRING ? new Date(ast.value) : null;
    },
  });
  
  const jsonScalar = new GraphQLScalarType({
    name: "Json",
    description: "A JSON value",
    serialize(value: unknown) {
      return typeof value === "object" ? JSON.stringify(value) : null;
    },
    parseValue(value: unknown) {
      return JSON.parse(value as string);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) return JSON.parse(ast.value);
      return null;
    },
  });
  

// GraphQL Resolvers
const resolvers = {
    DateTime: dateTimeScalar, // ✅ Fix DateTime error
    Json: jsonScalar, // ✅ Fix JSON error
  
    Query: {
      users: async () => await prisma.user.findMany(),
      maps: async () => await prisma.map.findMany({ include: { owner: true } }),
      trafficData: async () => await prisma.trafficData.findMany(),
      weatherData: async () => await prisma.weatherData.findMany(),
    },
  
    Mutation: {
      createUser: async (_: unknown, { name, email, password }: { 
        name: string; 
        email: string; 
        password: string; 
      }) => {
        return await prisma.user.create({
          data: { name, email, password, role: "user" },
        });
      },
      createMap: async (_: unknown, { name, type, ownerId }: { 
        name: string; 
        type: string; 
        ownerId: string; 
      }) => {
        return await prisma.map.create({
          data: { name, type, owner: { connect: { id: ownerId } } },
        });
      },
      createTrafficData: async (_: unknown, { trafficLevel, mapId }: { 
        trafficLevel: string; 
        mapId: string; 
      }) => {
        const newTraffic = await prisma.trafficData.create({
          data: { trafficLevel, timestamp: new Date(), map: { connect: { id: mapId } } },
        });
        pubsub.publish("TRAFFIC_UPDATED", { trafficUpdated: newTraffic });
        return newTraffic;
      },
      createWeatherData: async (_: unknown, { temperature, conditions, mapId }: { 
        temperature: number; 
        conditions: string; 
        mapId: string; 
      }) => {
        const newWeather = await prisma.weatherData.create({
          data: { temperature, conditions, timestamp: new Date(), map: { connect: { id: mapId } } },
        });
        pubsub.publish("WEATHER_UPDATED", { weatherUpdated: newWeather });
        return newWeather;
      },
    },
  
    Subscription: {
      trafficUpdated: {
        subscribe: () => pubsub.asyncIterableIterator(["TRAFFIC_UPDATED"]),
      },
      weatherUpdated: {
        subscribe: () => pubsub.asyncIterableIterator(["WEATHER_UPDATED"]),
      },
    },
  };
  
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const server = new ApolloServer({ schema });
  
  const handler = startServerAndCreateNextHandler(server);
  
  export const GET = handler;
  export const POST = handler;
  